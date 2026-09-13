/* ============================================================
 * models/hinge.js — 转轴(追加下钻模型)
 * buildDetail():齿轮/摩擦片结构 + "悬停任意角度"的摩擦力矩平衡示意:
 *   两片摩擦片被螺母压紧夹住转轴柱,屏幕侧的重力箭头 vs 摩擦力矩箭头,
 *   屏幕停在不同角度时两者始终平衡(不自由下垂)。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.hinge = {};

// 一对金属转轴柱(屏幕总成与主体共用;含端盖与扭矩屏蔽罩)
LX.models.hinge.buildBarrels = function (spacing = 0.9, len = 0.6, r = 0.045) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(r, r, len, 16);
  geo.rotateZ(Math.PI / 2);
  for (const x of [-spacing, spacing]) {
    const h = new THREE.Mesh(geo, LX.materials.hinge());
    h.position.set(x, 0, 0);
    g.add(h);
    // 端盖(转轴两端压入的金属帽)
    const cap = LX.geo.rbox(0.024, 0.13, 0.13,
      LX.materials.mat(0x565d68, { metalness: 0.75, roughness: 0.35 }), 0.004, 1);
    cap.position.set(x + Math.sign(x) * (len / 2 + 0.012), 0, 0);
    g.add(cap);
  }
  // 扭矩屏蔽罩(连接屏幕与 C 壳的金属桥架)
  const shield = LX.geo.rbox(0.62, 0.09, 0.15, LX.materials.alu(), 0.01, 1);
  shield.position.set(0, 0.015, 0);
  g.add(shield);
  return g;
};

LX.models.hinge.buildDetail = function () {
  const g = new THREE.Group();

  // 转轴柱(金属,沿 x 轴)
  const axis = LX.geo.cyl(0.09, 1.1, LX.materials.hinge(), 20);
  axis.rotation.z = Math.PI / 2;
  g.add(axis);

  // 摩擦片组:两片圆盘夹片 + 压紧螺母(弹簧垫圈示意)
  const plateMat = LX.materials.mat(0x565d68, { metalness: 0.75, roughness: 0.35 });
  const frictionMat = LX.materials.mat(0x8a6a3a, { metalness: 0.3, roughness: 0.75, roughnessMap: LX.textures.grain() });
  const plates = [];
  for (const sx of [-0.32, 0.32]) {
    const plate = LX.geo.cyl(0.2, 0.05, plateMat, 24);
    plate.rotation.z = Math.PI / 2;
    plate.position.x = sx;
    g.add(plate);
    plates.push(plate);
  }
  const friction = LX.geo.cyl(0.15, 0.06, frictionMat, 24);
  friction.rotation.z = Math.PI / 2;
  friction.position.x = 0;
  g.add(friction);
  // 压紧螺母
  for (const sx of [-0.42, 0.42]) {
    const nut = LX.geo.cyl(0.055, 0.05, LX.materials.mat(0xb9bec6, { metalness: 0.9, roughness: 0.25 }), 6);
    nut.rotation.z = Math.PI / 2;
    nut.position.x = sx;
    g.add(nut);
  }

  // 齿轮啮合示意(两端小齿轮 + 齿圈)
  const gearMat = LX.materials.mat(0x9aa2ad, { metalness: 0.85, roughness: 0.3 });
  const mkGear = (r, teeth, len) => {
    const gear = new THREE.Group();
    const body = LX.geo.cyl(r, len, gearMat, 24);
    body.rotation.z = Math.PI / 2;
    gear.add(body);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tooth = LX.geo.rbox(0.02, len * 0.9, 0.035, gearMat, 0, 1);
      tooth.position.set(Math.cos(a) * (r + 0.015), Math.sin(a) * (r + 0.015), 0);
      tooth.rotation.z = a;
      gear.add(tooth);
    }
    return gear;
  };
  const gearA = mkGear(0.13, 12, 0.1);
  gearA.position.x = -0.14;
  const gearB = mkGear(0.16, 16, 0.1);
  gearB.position.x = 0.14;
  g.add(gearA, gearB);

  // 屏幕示意杆(从转轴伸出,可停任意角度)
  const lidArm = new THREE.Group();
  const arm = LX.geo.rbox(0.16, 0.9, 0.06, LX.materials.alu(), 0.01, 2);
  arm.position.y = 0.45;
  lidArm.add(arm);
  lidArm.position.set(0.55, 0.05, 0);
  lidArm.rotation.z = -0.6; // 悬停在约 35°
  g.add(lidArm);
  // 屏幕面板(示意)
  const panel = LX.geo.rbox(0.06, 0.8, 0.5, LX.materials.screenGlass(), 0.008, 2);
  panel.position.set(0.06, 0.45, 0);
  lidArm.add(panel);

  // 重力箭头(红,向下)与摩擦力矩箭头(绿,沿转轴切向)
  const arrowMatG = new THREE.MeshBasicMaterial({ color: 0xff5050 });
  const arrowMatF = new THREE.MeshBasicMaterial({ color: 0x51e88c });
  const mkArrow = (mat, len) => {
    const grp = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 8), mat);
    grp.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 10), mat);
    tip.position.y = len / 2 + 0.03;
    grp.add(tip);
    return grp;
  };
  const gravityArrow = mkArrow(arrowMatG, 0.4);
  gravityArrow.position.set(0.62, 0.62, 0.15);
  const frictionArrow = mkArrow(arrowMatF, 0.36);
  frictionArrow.position.set(0.36, 0.72, 0.15);
  frictionArrow.rotation.z = 0.9;
  g.add(gravityArrow, frictionArrow);

  const gLab = tLabel('重力力矩', '#ff8080', 0.62); gLab.position.set(0.62, 0.28, 0.15);
  const fLab = tLabel('摩擦力矩', '#80ffb0', 0.62); fLab.position.set(0.32, 1.05, 0.15);
  const hLab = tLabel('摩擦片 + 齿轮啮合 → 悬停任意角度', '#cfe3ff', 1.0); hLab.position.set(0, 1.35, 0);
  g.add(gLab, fLab, hLab);

  // 动画:屏幕在几个角度间缓慢摆动,摆到哪停哪(悬停);齿轮/摩擦片与屏幕刚性联动
  let targetA = -0.6;
  let prevZ = lidArm.rotation.z;
  g.userData.tick = (dt, t) => {
    const cyc = (t * 0.35) % 3;
    const angles = [-0.55, -1.25, -0.35];
    const idx = Math.floor(cyc);
    const k = Math.min((cyc - idx) / 0.55, 1);
    if (k >= 1) targetA = angles[(idx + 1) % 3];
    lidArm.rotation.z += (targetA - lidArm.rotation.z) * Math.min(dt * 2.2, 1);
    // 屏幕转多少,齿轮就啮合转多少(齿数比),摩擦片间出现摩擦微光——
    // 静止悬停时全部静止:正是"摩擦力矩平衡"的直观表现
    const dA = lidArm.rotation.z - prevZ;
    prevZ = lidArm.rotation.z;
    gearA.rotation.x += dA * 2.0;
    gearB.rotation.x -= dA * 2.0 * (12 / 16);
    const moving = Math.min(Math.abs(dA) * 60, 1);
    frictionMat.emissive.setHex(0xff7030);
    frictionMat.emissiveIntensity += (moving * 0.5 - frictionMat.emissiveIntensity) * Math.min(dt * 8, 1);
    // 重力箭头跟随屏幕末端
    gravityArrow.position.set(0.62 + Math.sin(-lidArm.rotation.z) * 0.7, 0.62 + Math.cos(-lidArm.rotation.z) * 0.55, 0.15);
  };

  return g;
};
