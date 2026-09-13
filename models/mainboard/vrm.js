/* ============================================================
 * models/mainboard/vrm.js — VRM 供电模块(主板子节点)
 * 原理演示:输入电容 → MOSFET 高频开合(高/低臂交替发光)→
 * 电感储能释放 → 输出电容滤波。
 * 电流路径用 LX.particles 发光粒子流(带拖尾)表现:
 * 输入侧粒子"脉冲式"断续前进,输出侧粒子匀速直流——
 * 直观呈现"从脉冲变直流"。
 * 动画全部驱动 self.userData.tick(dt, t)(管理器契约)。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.vrm = {};

const M3 = LX.materials;

// 材质(每次 build 新建;MOSFET 高/低臂各一份,便于交替发光)
function mkVrmMats() {
  return {
    pcb: M3.pcb(),
    inductor: M3.mat(0x1b1d22, { metalness: 0.3, roughness: 0.75, roughnessMap: LX.textures.grain() }),
    mosfetHigh: M3.mat(0x1f2329, { metalness: 0.45, roughness: 0.4, emissive: 0x66ccff, emissiveIntensity: 0.1 }),
    mosfetLow: M3.mat(0x1f2329, { metalness: 0.45, roughness: 0.4, emissive: 0xffaa44, emissiveIntensity: 0.1 }),
    cap: M3.mat(0x2b2f36, { metalness: 0.55, roughness: 0.4 }),
    capTop: M3.mat(0x33383f, { metalness: 0.5, roughness: 0.45 }),
    groove: M3.mat(0x101318, { metalness: 0.4, roughness: 0.6 }),
    bus: M3.copper(),
    gold: M3.mat(0xc9a227, { metalness: 0.9, roughness: 0.3 }),
  };
}

// 电感(放大版,顶部铜绕组)
function inductorL(mats, r, h) {
  const g = new THREE.Group();
  const body = LX.geo.cyl(r, h, mats.inductor, 20);
  body.position.y = h / 2;
  const w1 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, 0.012, 8, 24), M3.copper());
  w1.rotation.x = Math.PI / 2;
  w1.position.y = h - 0.01;
  const w2 = w1.clone();
  w2.position.y = h * 0.45;
  g.add(body, w1, w2);
  return g;
}

// MOSFET(放大版,本体材质决定开合发光)
function mosfetL(mats, mat, w = 0.16, h = 0.045, d = 0.1) {
  const g = new THREE.Group();
  const body = LX.geo.rbox(w, h, d, mat, 0.006, 1);
  body.position.y = h / 2;
  const pinL = LX.geo.rbox(w * 0.42, 0.006, d * 0.3, M3.copper(), 0, 1);
  pinL.position.set(-w * 0.24, h + 0.002, -d * 0.22);
  const pinR = pinL.clone();
  pinR.position.x = w * 0.24;
  g.add(body, pinL, pinR);
  return g;
}

// 电容(放大版,防爆槽刻线)
function capL(mats, r = 0.045, h = 0.1) {
  const g = new THREE.Group();
  const body = LX.geo.cyl(r, h, mats.cap, 16);
  body.position.y = h / 2;
  const rim = LX.geo.cyl(r * 0.78, 0.004, mats.capTop, 16);
  rim.position.y = h - 0.001;
  const slotL = LX.geo.rbox(r * 1.3, 0.004, r * 0.22, mats.groove, 0, 1);
  slotL.position.y = h + 0.0005;
  const slotS = LX.geo.rbox(r * 0.22, 0.004, r * 1.3, mats.groove, 0, 1);
  slotS.position.y = h + 0.0005;
  g.add(body, rim, slotL, slotS);
  return g;
}

/* ---------- VRM 特写模型 ---------- */
LX.models.vrm.buildDetail = function () {
  const mats = mkVrmMats();
  const g = new THREE.Group();

  // 迷你基板(圆角,PCB 贴图)
  const sub = LX.geo.rbox(1.3, 0.035, 0.9, mats.pcb, 0.02, 2);
  sub.position.y = 0.018;
  g.add(sub);

  // 布局:左=输入电容列;中=两排 MOSFET;中右=电感排;右=输出电容列
  //      铜排(母排)连接各段,粒子沿铜排上方流动
  const rail = (w, d, x, z) => {
    const r = LX.geo.rbox(w, 0.012, d, mats.bus, 0, 1);
    r.position.set(x, 0.052, z);
    return r;
  };
  g.add(rail(0.04, 0.72, -0.5, 0));    // 输入母排
  g.add(rail(0.6, 0.04, -0.22, -0.28)); // 开关节点排(上)
  g.add(rail(0.6, 0.04, -0.22, 0.28));  // 开关节点排(下)
  g.add(rail(0.04, 0.72, 0.06, 0));     // 电感汇流排
  g.add(rail(0.04, 0.72, 0.52, 0));     // 输出母排

  // 输入电容(左列,4 颗)
  for (let i = 0; i < 4; i++) {
    const c = capL(mats);
    c.position.set(-0.5, 0.036, -0.27 + i * 0.18);
    g.add(c);
  }
  // MOSFET 高臂(上排)/ 低臂(下排),各 3 颗
  for (let i = 0; i < 3; i++) {
    const hi = mosfetL(mats, mats.mosfetHigh);
    hi.position.set(-0.42 + i * 0.2, 0.036, -0.28);
    g.add(hi);
    const lo = mosfetL(mats, mats.mosfetLow);
    lo.position.set(-0.42 + i * 0.2, 0.036, 0.28);
    g.add(lo);
  }
  // 电感(中列,3 颗)
  for (let i = 0; i < 3; i++) {
    const ind = inductorL(mats, 0.085, 0.12);
    ind.position.set(0.06, 0.036, -0.24 + i * 0.24);
    g.add(ind);
  }
  // 输出电容(右列,4 颗)——滤波后级的"平波"担当
  const outCaps = [];
  for (let i = 0; i < 4; i++) {
    const c = capL(mats);
    c.position.set(0.52, 0.036, -0.27 + i * 0.18);
    outCaps.push(c);
    g.add(c);
  }

  // ----- 发光粒子流:电流路径(带拖尾) -----
  // 路径 1:输入母排 → MOSFET(脉冲式:速度被开关方波调制)
  const inCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.52, 0.1, -0.3),
    new THREE.Vector3(-0.52, 0.1, 0.0),
    new THREE.Vector3(-0.52, 0.1, 0.3),
    new THREE.Vector3(-0.42, 0.12, 0.3),
    new THREE.Vector3(-0.28, 0.12, 0.22),
  ]);
  // 路径 2:开关节点 → 电感(半脉冲)
  const midCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, 0.1, -0.26),
    new THREE.Vector3(-0.05, 0.11, -0.24),
    new THREE.Vector3(0.02, 0.1, -0.1),
    new THREE.Vector3(0.02, 0.1, 0.1),
    new THREE.Vector3(-0.05, 0.11, 0.24),
    new THREE.Vector3(-0.2, 0.1, 0.26),
  ]);
  // 路径 3:电感汇流 → 输出母排 → 输出电容(直流:匀速稳定)
  const outCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.08, 0.1, -0.28),
    new THREE.Vector3(0.14, 0.1, -0.1),
    new THREE.Vector3(0.14, 0.1, 0.1),
    new THREE.Vector3(0.08, 0.1, 0.28),
    new THREE.Vector3(0.3, 0.1, 0.0),
    new THREE.Vector3(0.52, 0.11, 0.0),
  ]);
  const flowIn = LX.particles.createFlow({ curve: inCurve, count: 120, color: 0x66d9ff, size: 0.014, speed: 0.16, tail: 4, opacity: 0.85 });
  const flowMid = LX.particles.createFlow({ curve: midCurve, count: 100, color: 0x9fe8b5, size: 0.016, speed: 0.11, tail: 3, opacity: 0.85 });
  const flowOut = LX.particles.createFlow({ curve: outCurve, count: 110, color: 0xd8ffe8, size: 0.017, speed: 0.09, tail: 3, opacity: 0.85 });
  g.add(flowIn.group, flowMid.group, flowOut.group);

  // 输出电容滤波指示:输出侧电容顶部常亮微光(被"滤平"的直流)
  const outGlow = new THREE.MeshStandardMaterial({
    color: 0x0a1a12, emissive: 0x44ff99, emissiveIntensity: 0.35,
  });
  for (const c of outCaps) {
    const capGlow = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.005, 8, 20), outGlow);
    capGlow.rotation.x = Math.PI / 2;
    capGlow.position.y = 0.102;
    c.add(capGlow);
  }

  // ----- 动画:MOSFET 高/低臂交替开合;输入粒子按方波"脉冲"推进 -----
  g.userData.tick = (dt, t) => {
    const chopping = Math.sin(t * 26) > 0; // 高频开关方波
    mats.mosfetHigh.emissiveIntensity = chopping ? 1.5 : 0.08;
    mats.mosfetLow.emissiveIntensity = chopping ? 0.08 : 1.3;

    // 输入粒子:只在开关闭合时流动(脉冲),输出粒子:匀速(直流)
    flowIn.update(dt * (chopping ? 2.2 : 0.12));
    flowMid.update(dt * (chopping ? 1.4 : 0.45));
    flowOut.update(dt); // 直流:恒速

    // 输出电容微光随直流稳定(呼吸极缓,示意"已被滤平")
    outGlow.emissiveIntensity = 0.32 + Math.sin(t * 2.2) * 0.06;
  };
  return g;
};
