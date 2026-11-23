// Sky, sun and the day-night cycle: a gradient dome with a sun disk and stars, the warm key light
// with shadows that follow the player, hemisphere fill, fog, and an environment map regenerated
// from the sky so glass and car paint reflect the current hour.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/mathutil.js';

const KEYS = [
  // hour, zenith, horizon, sun colour, sun intensity, hemi intensity, fog
  [0, '#060818', '#1a1a3a', '#8090ff', 0.18, 0.35, '#141631'],
  [5, '#0b1030', '#3a2a55', '#a090ff', 0.2, 0.4, '#2a2445'],
  [6.3, '#3b4f8f', '#ff9a7a', '#ffb080', 1.2, 0.7, '#e0a08a'],
  [8, '#4f9fe8', '#ffe0c0', '#fff0d8', 2.6, 1.0, '#e8d8cc'],
  [12, '#2f86e8', '#cfe8ff', '#ffffff', 3.0, 1.1, '#d0e4f4'],
  [16, '#2c6fd6', '#ffd8a8', '#fff0d0', 2.9, 1.0, '#e8cdb4'],
  [18, '#2f5cc0', '#ffa860', '#ffc080', 2.7, 0.9, '#eab08c'],
  [19.3, '#3a3f88', '#ff6a4a', '#ff8a50', 1.6, 0.75, '#e07a6a'],
  [20.3, '#141a48', '#7a3a6a', '#c080ff', 0.35, 0.5, '#3a2a50'],
  [22, '#070a20', '#22224a', '#8090ff', 0.2, 0.38, '#181a38'],
  [24, '#060818', '#1a1a3a', '#8090ff', 0.18, 0.35, '#141631'],
];
const cA = new THREE.Color(), cB = new THREE.Color();

function sample(hour) {
  let k = 0;
  while (k < KEYS.length - 2 && KEYS[k + 1][0] <= hour) k++;
  const a = KEYS[k], b = KEYS[k + 1];
  const t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
  const mix = (ia) => cA.set(a[ia]).lerp(cB.set(b[ia]), t).clone();
  return { zenith: mix(1), horizon: mix(2), sun: mix(3), sunI: lerp(a[4], b[4], t), hemiI: lerp(a[5], b[5], t), fog: mix(6) };
}

export function sunDirection(hour, out = new THREE.Vector3()) {
  const f = (hour - 6) / 13.8;
  if (f > 0 && f < 1) {
    const el = Math.sin(f * Math.PI) * 1.15;
    out.set(Math.cos(Math.PI * f) * Math.cos(el), Math.sin(el), 0.75 * Math.cos(el) + 0.2).normalize();
  } else {
    out.set(-0.3, 0.8, -0.5).normalize(); // moonlight from the north-west
  }
  return out;
}

export function createSky(scene, renderer) {
  const uniforms = {
    zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, night: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float night;
      varying vec3 vDir;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(horizon, zenith, pow(max(h,0.0), 0.55));
        col = mix(col, horizon * 0.8, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 30.0) * 0.35 + pow(s, 4.0) * 0.12) * (1.0 - night * 0.7);
        // a few soft cloud streaks near the horizon
        float band = smoothstep(0.02, 0.1, h) * smoothstep(0.32, 0.12, h);
        float cl = sin(d.x * 9.0 + d.z * 3.0) * sin(d.z * 13.0 - d.x * 5.0 + 1.7) * 0.5 + 0.5;
        col = mix(col, mix(horizon, vec3(1.0), 0.35) * (1.0 - night * 0.6), band * smoothstep(0.55, 0.95, cl) * 0.45);
        // stars
        vec3 cell = floor(d * 260.0);
        float st = step(0.9975, hash(cell)) * night * smoothstep(0.05, 0.3, h);
        col += vec3(st);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  scene.add(dome);

  const sun = new THREE.DirectionalLight('#ffffff', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 10; sc.far = 700;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#bfe0ff', '#c8a878', 1);
  scene.add(hemi);
  scene.fog = new THREE.Fog('#f0d0b0', 170, 1250);

  // environment map from the sky alone
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
  envScene.add(envDome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTarget = pmrem.fromScene(envScene, 0.02);
  let envHour = -10;

  const dir = new THREE.Vector3();
  const state = {
    hour: 17.5, night: 0, sunDir: dir,
    get envMap() { return envTarget.texture; },
    /** Set the time of day and move the shadow-casting light to follow `focus`. */
    update(hour, focus) {
      state.hour = hour;
      const s = sample(hour);
      sunDirection(hour, dir);
      const night = 1 - smoothstep(-0.05, 0.12, dir.y) * (hour > 5 && hour < 21 ? 1 : 0);
      state.night = clamp(hour >= 20.2 || hour < 5.5 ? 1 : hour > 19 ? (hour - 19) / 1.2 : hour < 6.5 ? (6.5 - hour) : 0, 0, 1);
      void night;
      uniforms.zenith.value.copy(s.zenith);
      uniforms.horizon.value.copy(s.horizon);
      uniforms.sunDir.value.copy(dir);
      uniforms.sunColor.value.copy(s.sun);
      uniforms.night.value = state.night;
      sun.color.copy(s.sun);
      sun.intensity = s.sunI;
      hemi.intensity = s.hemiI;
      hemi.color.copy(s.zenith).lerp(new THREE.Color('#ffffff'), 0.5);
      hemi.groundColor.set(state.night > 0.5 ? '#202030' : '#c8a878');
      scene.fog.color.copy(s.fog);
      sun.position.set(focus.x + dir.x * 300, dir.y * 300, focus.z + dir.z * 300);
      sun.target.position.set(focus.x, 0, focus.z);
      // snap the shadow camera to texel steps so shadows do not shimmer while moving
      if (Math.abs(hour - envHour) > 0.4) {
        envHour = hour;
        envTarget.dispose();
        envTarget = pmrem.fromScene(envScene, 0.02);
        state.onEnvChange?.(envTarget.texture);
      }
    },
    dome,
  };
  return state;
}
