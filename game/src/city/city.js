// Builds the whole of Sunvale into a scene in dependency order and returns the pieces that change
// over time (sky, sea, signals, the Ferris wheel, night lighting).
import { clearColliders } from './collision.js';
import { buildRoads } from './roads.js';
import { buildBuildings } from './buildings.js';
import { buildProps } from './props.js';
import { buildLandmarks } from './landmarks.js';
import { buildWater } from './water.js';
import { createSky } from './sky.js';
import { setAnisotropy } from './textures.js';

export function buildCity(scene, renderer) {
  clearColliders();
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const sky = createSky(scene, renderer);
  sky.onEnvChange = (tex) => { scene.environment = tex; };
  scene.environment = sky.envMap;
  scene.environmentIntensity = 0.55;
  buildRoads(scene);
  const buildings = buildBuildings(scene, null);
  const props = buildProps(scene, buildings.palms, buildings.extras);
  const landmarks = buildLandmarks(scene);
  const water = buildWater(scene, null);

  return {
    sky, buildings, props, landmarks, water,
    /** Advance the living parts of the city: time of day (hours), focus for shadows. */
    update(time, dt, hour, focus) {
      sky.update(hour, focus);
      const night = sky.night;
      buildings.setNight(night);
      props.update(time, night);
      landmarks.update(time, dt, night);
      water.update(time);
    },
  };
}
