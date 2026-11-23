// HDR post-processing: the scene renders into a half-float target, the brightest parts (neon,
// headlights, light bars, fire, the sun) are extracted and blurred at quarter and eighth resolution
// for bloom, and a final pass adds the glow back, grades the image toward Sunvale's golden hour
// (warm highlights, cool shadows, a touch more contrast and saturation), applies the renderer's
// ACES tone mapping and a soft vignette.
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function target(w, h, samples = 0) {
  const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, depthBuffer: samples > 0, samples });
  t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter;
  return t;
}

export function createPost(renderer) {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const bright = new THREE.ShaderMaterial({
    uniforms: { src: { value: null }, threshold: { value: 1.0 } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D src; uniform float threshold; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(src, vUv).rgb;
        float l = max(c.r, max(c.g, c.b));
        float soft = clamp(l - threshold * 0.6, 0.0, threshold * 0.8);
        soft = soft * soft / (threshold * 3.2 + 1e-4);
        float w = max(soft, l - threshold) / max(l, 1e-4);
        gl_FragColor = vec4(min(c * w, vec3(5.0)), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const blur = new THREE.ShaderMaterial({
    uniforms: { src: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(src, vUv).rgb * 0.2270270;
        c += (texture2D(src, vUv + dir * 1.3846154).rgb + texture2D(src, vUv - dir * 1.3846154).rgb) * 0.3162162;
        c += (texture2D(src, vUv + dir * 3.2307692).rgb + texture2D(src, vUv - dir * 3.2307692).rgb) * 0.0702703;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const composite = new THREE.ShaderMaterial({
    uniforms: {
      src: { value: null }, bloomA: { value: null }, bloomB: { value: null },
      strength: { value: 0.75 }, warmth: { value: 1 }, vignette: { value: 0.32 },
    },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D src; uniform sampler2D bloomA; uniform sampler2D bloomB;
      uniform float strength; uniform float warmth; uniform float vignette; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(src, vUv).rgb;
        vec3 b = texture2D(bloomA, vUv).rgb * 0.6 + texture2D(bloomB, vUv).rgb * 0.9;
        c += b * strength;
        // grade in linear light: cool the shadows, warm the highlights, lift saturation and contrast
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 shadowTint = vec3(0.92, 0.97, 1.08), lightTint = vec3(1.07, 1.0, 0.9);
        c *= mix(vec3(1.0), mix(shadowTint, lightTint, smoothstep(0.02, 0.7, l)), warmth);
        c = mix(vec3(l), c, 1.0 + 0.16 * warmth);
        c = max(c, 0.0);
        c = pow(c / 0.18, vec3(1.08)) * 0.18;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec2 q = vUv - 0.5;
        gl_FragColor.rgb *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
      }`,
    depthTest: false, depthWrite: false,
  });

  let main = null, half = null, qA = null, qB = null, eA = null, eB = null;
  const size = new THREE.Vector2();
  function ensure() {
    renderer.getDrawingBufferSize(size);
    if (main && main.width === size.x && main.height === size.y) return;
    for (const t of [main, half, qA, qB, eA, eB]) t?.dispose();
    const samples = renderer.capabilities.isWebGL2 ? 4 : 0;
    main = target(size.x, size.y, samples);
    half = target(size.x >> 1, size.y >> 1);
    qA = target(size.x >> 2, size.y >> 2); qB = target(size.x >> 2, size.y >> 2);
    eA = target(size.x >> 3, size.y >> 3); eB = target(size.x >> 3, size.y >> 3);
  }

  function pass(mat, out) {
    quad.material = mat;
    renderer.setRenderTarget(out);
    renderer.render(scene, cam);
  }
  function blurInto(a, b, passes) {
    for (let k = 0; k < passes; k++) {
      blur.uniforms.src.value = a.texture; blur.uniforms.dir.value.set(1 / a.width, 0); pass(blur, b);
      blur.uniforms.src.value = b.texture; blur.uniforms.dir.value.set(0, 1 / a.height); pass(blur, a);
    }
  }

  const post = {
    enabled: true,
    composite: composite.uniforms,
    threshold: bright.uniforms.threshold,
    render(world, camera) {
      if (!post.enabled) { renderer.setRenderTarget(null); renderer.render(world, camera); return; }
      ensure();
      renderer.setRenderTarget(main);
      renderer.render(world, camera);
      bright.uniforms.src.value = main.texture; pass(bright, half);
      blur.uniforms.src.value = half.texture; blur.uniforms.dir.value.set(0.5 / half.width, 0.5 / half.height);
      pass(blur, qA);
      blurInto(qA, qB, 2);
      blur.uniforms.src.value = qA.texture; blur.uniforms.dir.value.set(0.5 / qA.width, 0.5 / qA.height);
      pass(blur, eA);
      blurInto(eA, eB, 2);
      composite.uniforms.src.value = main.texture;
      composite.uniforms.bloomA.value = qA.texture;
      composite.uniforms.bloomB.value = eA.texture;
      pass(composite, null);
    },
  };
  return post;
}
