/* ============================================================
 * core/csgUtils.js — 布尔/几何工具(核心复用件)
 *
 * 本项目无构建环境,未引入 CSG 库;棱柱类"挖孔/凹槽"统一用
 * Shape.holes + ExtrudeGeometry 实现(等效布尔,QUALITY_BASELINE 〇.3):
 * 孔洞沿挤出方向贯通,有真实孔壁与深度。
 * 复杂曲面件的布尔需求出现时,在此文件封装 CSG 库的调用入口。
 * ============================================================ */
window.LX = window.LX || {};
LX.geo = {};

/** 圆角盒(RoundedBoxGeometry 封装;r=0 时退化为普通盒) */
LX.geo.rbox = (w, h, d, material, r = 0, seg = 2) =>
  new THREE.Mesh(r > 0 ? new THREE.RoundedBoxGeometry(w, h, d, seg, r) : new THREE.BoxGeometry(w, h, d), material);

/** 圆柱 */
LX.geo.cyl = (r, h, material, seg = 24) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material);

/** (u,v) 平面矩形开孔路径(顺时针,与外轮廓反向) */
LX.geo.rectHole = (cu, cv, w, h) => {
  const p = new THREE.Path();
  p.moveTo(cu - w / 2, cv - h / 2);
  p.lineTo(cu - w / 2, cv + h / 2);
  p.lineTo(cu + w / 2, cv + h / 2);
  p.lineTo(cu + w / 2, cv - h / 2);
  p.closePath();
  return p;
};

/** (u,v) 平面圆形开孔路径 */
LX.geo.circleHole = (cu, cv, r) => {
  const p = new THREE.Path();
  p.absarc(cu, cv, r, 0, Math.PI * 2, true);
  return p;
};

/** 平行四边形开孔(跟随斜边,如楔形顶面上的长槽) */
LX.geo.paraHole = (u0, u1, vTop0, vTop1, h) => {
  const p = new THREE.Path();
  p.moveTo(u0, vTop0);
  p.lineTo(u1, vTop1);
  p.lineTo(u1, vTop1 - h);
  p.lineTo(u0, vTop0 - h);
  p.closePath();
  return p;
};

/**
 * 挤出一个带孔洞的板/墙。
 * @param {THREE.Shape} shape 含外轮廓与 holes
 * @param {object} opts { depth, bevel }
 * @returns {THREE.ExtrudeGeometry}
 */
LX.geo.extrudeWithHoles = (shape, opts = {}) => {
  const { depth = 0.05, bevel = false } = opts;
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel,
    bevelThickness: bevel ? 0.003 : 0,
    bevelSize: bevel ? 0.003 : 0,
    bevelSegments: 1,
    curveSegments: 8,
  });
};
