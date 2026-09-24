import * as T from '../vendor/three.module.js';
import { HDRLoader } from '../vendor/addons/loaders/HDRLoader.js';

export async function loadAssets(renderer, progress = () => {}) {
  const loader = new T.TextureLoader();
  const specs = {
    road: ['road-Diffuse.jpg', 'road-nor_gl.jpg'],
    concrete: ['concrete-Diffuse.jpg', 'concrete-nor_gl.jpg'],
    grass: ['grass-Diffuse.jpg', 'grass-nor_gl.jpg'],
    roof: ['roof-Diffuse.jpg', 'roof-nor_gl.jpg'],
    plaster: ['plaster-Diffuse.jpg', 'plaster-nor_gl.jpg'],
    leaves: ['tree-leaves_diff.jpg', null],
    bark: ['tree-branch_diff.jpg', null],
  };
  let complete = 0;
  const assets = {};
  await Promise.all(Object.entries(specs).map(async ([name, files]) => {
    const maps = await Promise.all(files.map((f) => f ? loader.loadAsync('./assets/' + f) : null));
    maps.forEach((t, i) => {
      if (!t) return;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      if (i === 0) t.colorSpace = T.SRGBColorSpace;
    });
    assets[name] = { map: maps[0], normalMap: maps[1] };
    progress(++complete / 9);
  }));
  const source = await fetch('./assets/sources.json').then(r => r.json());
  const alphaFile = source.find(s => s.file.startsWith('tree-leaves_alpha')).file;
  assets.leaves.alphaMap = await loader.loadAsync('./assets/' + alphaFile);
  progress(++complete / 9);
  assets.sky = await new HDRLoader().loadAsync('./assets/sky.hdr');
  assets.sky.mapping = T.EquirectangularReflectionMapping;
  progress(1);
  return assets;
}
