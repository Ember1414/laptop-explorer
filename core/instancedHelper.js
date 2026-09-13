/* ============================================================
 * core/instancedHelper.js — InstancedMesh 批量渲染封装
 * 密集重复小件(贴片元件、内存颗粒、螺丝群)统一走这里,
 * 每个实例带轻微随机扰动(QUALITY_BASELINE 〇.4)。
 * ============================================================ */
window.LX = window.LX || {};
LX.instanced = {};

/**
 * 用给定变换数组构建 InstancedMesh。
 * @param {THREE.BufferGeometry} geo
 * @param {THREE.Material} material
 * @param {Array} transforms [{ p:[x,y,z], r?:[rx,ry,rz], s?:number }, ...]
 */
LX.instanced.build = function (geo, material, transforms) {
  const im = new THREE.InstancedMesh(geo, material, transforms.length);
  const d = new THREE.Object3D();
  transforms.forEach((t, i) => {
    d.position.set(t.p[0], t.p[1], t.p[2]);
    d.rotation.set(t.r ? t.r[0] : 0, t.r ? t.r[1] : 0, t.r ? t.r[2] : 0);
    if (t.s) d.scale.setScalar(t.s);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
  return im;
};

/**
 * 生成一批带扰动的变换(位置网格 + 随机抖动)。
 * @param {object} opts
 *   from:[x,y,z] 起点网格索引原点, step:[dx,dy,dz] 间距, cols/rows/layers 网格规模,
 *   jitterP 位置抖动幅度, jitterR 旋转抖动幅度(弧度), scaleRange:[min,max], seed 随机种子
 */
LX.instanced.jitterGrid = function (opts) {
  const {
    from = [0, 0, 0], step = [0.1, 0, 0],
    cols = 1, rows = 1, layers = 1,
    jitterP = 0.01, jitterR = 0.1, scaleRange = [0.95, 1.05],
    seed = 1,
  } = opts;
  const rnd = LX.textures.random(seed);
  const out = [];
  for (let l = 0; l < layers; l++)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        out.push({
          p: [
            from[0] + c * step[0] + (rnd() - 0.5) * 2 * jitterP,
            from[1] + r * step[1] + (rnd() - 0.5) * 2 * jitterP,
            from[2] + l * step[2] + (rnd() - 0.5) * 2 * jitterP,
          ],
          r: [(rnd() - 0.5) * 2 * jitterR, (rnd() - 0.5) * 2 * jitterR, (rnd() - 0.5) * 2 * jitterR],
          s: scaleRange[0] + rnd() * (scaleRange[1] - scaleRange[0]),
        });
      }
  return out;
};
