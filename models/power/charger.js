/* ============================================================
 * models/power/charger.js — 电源适配器(充电器,整机外配件)
 * build()        适配器外观:电源砖 + 交流插头线 + DC 输出线(连到机身)
 * buildDetail()  内部下钻:交流输入 → 整流桥(四二极管电流路径)→
 *                高频开关变压器 → 滤波稳压 → 直流输出给电池充电
 *                (电流路径用发光粒子沿线流动;拓扑复用台式机 PSU 思路)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.charger = {};

const MCG = LX.materials;

function cgLabel(text, color, scale) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 72;
  const g = c.getContext('2d');
  g.font = 'bold 32px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 160, 48);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(scale || 0.9, (scale || 0.9) * 0.21, 1);
  return sp;
}

/* ---------- 适配器外观(根节点旁) ---------- */
LX.models.charger.build = function () {
  const g = new THREE.Group();

  // 电源砖
  const brick = LX.geo.rbox(0.75, 0.22, 0.75, MCG.mat(0x262b33, { metalness: 0.3, roughness: 0.55, roughnessMap: LX.textures.grain() }), 0.03, 3);
  brick.position.y = 0.11;
  g.add(brick);
  const brickTop = LX.geo.rbox(0.7, 0.005, 0.7, MCG.mat(0x2e333b, { roughness: 0.5, roughnessMap: LX.textures.grain() }), 0, 1);
  brickTop.position.y = 0.223;
  g.add(brickTop);
  // AC 输入凹口(砖体侧面,真机 C8 插座位)
  const inlet = LX.geo.rbox(0.01, 0.09, 0.12, MCG.mat(0x101318, { roughness: 0.7 }), 0, 1);
  inlet.position.set(-0.376, 0.11, 0.18);
  g.add(inlet);
  const led = LX.geo.cyl(0.012, 0.004, MCG.led(0x51e88c, 2.2), 10);
  led.position.set(0.28, 0.226, 0.28);
  g.add(led);
  const brickLabel = cgLabel('Ember 65W 适配器', '#8fd4ff', 0.75);
  brickLabel.position.set(0, 0.4, 0);
  g.add(brickLabel);

  // 线缆由整机模型统一弯管布放(AC 线 + DC 线插入机身 USB-C 充电口)

  return g;
};

/* ---------- 内部下钻:整流 → 开关变换 → 滤波 → 直流 ---------- */
LX.models.charger.buildDetail = function () {
  const g = new THREE.Group();

  // 基板
  const sub = LX.geo.rbox(2.7, 0.06, 1.5, MCG.pcb(), 0.014, 2);
  sub.position.y = 0.03;
  g.add(sub);

  /* ----- 桥式整流:四个二极管的菱形布局 ----- */
  const diodeMat = MCG.mat(0x14171c, { metalness: 0.3, roughness: 0.45 });
  const diodeMark = MCG.mat(0xd8d8d8, { roughness: 0.4 });
  const diodes = [];
  const bridgeC = new THREE.Vector3(-0.85, 0.1, 0);
  const BR = 0.22;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2; // 菱形四角
    const dx = Math.cos(a) * BR, dz = Math.sin(a) * BR;
    const dio = new THREE.Group();
    const body = LX.geo.rbox(0.09, 0.035, 0.05, diodeMat, 0.004, 1);
    body.position.y = 0.05;
    // 二极管符号标记(阴极横线)
    const mark = LX.geo.rbox(0.012, 0.002, 0.05, diodeMark, 0, 1);
    mark.position.y = 0.069;
    dio.add(body, mark);
    dio.position.set(bridgeC.x + dx, 0, bridgeC.z + dz);
    dio.rotation.y = -a;
    g.add(dio);
    diodes.push(dio);
  }
  // 桥的连线(菱形四边)
  const bridgeMat = new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.4 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, b = Math.PI / 4 + (i + 1) * Math.PI / 2;
    const p0 = new THREE.Vector3(bridgeC.x + Math.cos(a) * BR, 0.052, bridgeC.z + Math.sin(a) * BR);
    const p1 = new THREE.Vector3(bridgeC.x + Math.cos(b) * BR, 0.052, bridgeC.z + Math.sin(b) * BR);
    const len = p0.distanceTo(p1);
    const w = new THREE.Mesh(new THREE.BoxGeometry(len, 0.006, 0.02), bridgeMat);
    w.position.copy(p0).add(p1).multiplyScalar(0.5);
    w.rotation.y = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
    g.add(w);
  }
  const bridgeLab = cgLabel('整流桥(4× 二极管):交流 → 脉动直流', '#ffd75e', 0.72);
  bridgeLab.position.set(-0.85, 0.42, 0);
  g.add(bridgeLab);

  /* ----- 高频开关变压器(铁氧体磁芯 + 线圈) ----- */
  const transformer = new THREE.Group();
  transformer.position.set(0.1, 0, 0);
  const core = LX.geo.rbox(0.34, 0.18, 0.3, MCG.mat(0x1b1d22, { metalness: 0.2, roughness: 0.6, roughnessMap: LX.textures.grain() }), 0.01, 2);
  core.position.y = 0.14;
  transformer.add(core);
  const coilPri = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 8, 26), MCG.mat(0xc9a06a, { metalness: 0.7, roughness: 0.35 }));
  coilPri.rotation.y = Math.PI / 2;
  coilPri.position.set(-0.1, 0.14, 0);
  const coilSec = coilPri.clone();
  coilSec.position.x = 0.1;
  coilSec.material = MCG.mat(0x9fb8d8, { metalness: 0.6, roughness: 0.35 });
  transformer.add(coilPri, coilSec);
  const trLab = cgLabel('高频开关变压器', '#9fb8d8', 0.66);
  trLab.position.set(0.1, 0.45, 0);
  transformer.add(trLab);
  // 开关管(高频斩波 MOSFET)
  const switchFet = LX.geo.rbox(0.1, 0.05, 0.08, MCG.chip(), 0.005, 1);
  switchFet.position.set(-0.38, 0.075, -0.28);
  transformer.add(switchFet);
  const fetLab = cgLabel('开关管', '#8fd4ff', 0.5);
  fetLab.position.set(-0.38, 0.22, -0.28);
  transformer.add(fetLab);
  g.add(transformer);

  /* ----- 滤波稳压(电解电容 + 稳压块) ----- */
  const caps = [];
  for (let i = 0; i < 2; i++) {
    const cap = LX.geo.cyl(0.055, 0.14, MCG.mat(0x2b3a5a, { metalness: 0.4, roughness: 0.4 }), 18);
    cap.position.set(0.78, 0.12, -0.22 + i * 0.2);
    const ventMark = LX.geo.rbox(0.05, 0.004, 0.014, MCG.mat(0x101318), 0, 1);
    ventMark.position.set(0.78, 0.195, -0.22 + i * 0.2);
    caps.push(cap);
    g.add(cap, ventMark);
  }
  const reg = LX.geo.rbox(0.16, 0.05, 0.1, MCG.chip(), 0.005, 1);
  reg.position.set(0.78, 0.075, 0.22);
  g.add(reg);
  const outLab = cgLabel('滤波 + 稳压 → 直流输出', '#51e88c', 0.68);
  outLab.position.set(0.82, 0.4, 0);
  g.add(outLab);

  /* ----- 电流路径粒子:交流段(黄)→ 桥(脉动)→ 变压器(红)→ 直流段(绿) ----- */
  const ROUTE = [
    new THREE.Vector3(-1.35, 0.09, 0.2),   // 交流输入
    new THREE.Vector3(-1.1, 0.09, 0.05),   // 进桥
    new THREE.Vector3(-0.85, 0.07, 0.15),  // 桥中心
    new THREE.Vector3(-0.55, 0.09, -0.1),  // 出桥(脉动直流)
    new THREE.Vector3(-0.28, 0.1, -0.28),  // 开关管
    new THREE.Vector3(0.0, 0.12, -0.05),   // 变压器
    new THREE.Vector3(0.3, 0.1, -0.1),     // 副边
    new THREE.Vector3(0.78, 0.12, -0.05),  // 滤波电容
    new THREE.Vector3(1.15, 0.1, 0.25),    // 稳压输出
    new THREE.Vector3(1.5, 0.1, 0.4),      // 去往机身/电池
  ];
  const segs = [];
  let total = 0;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const l = ROUTE[i].distanceTo(ROUTE[i + 1]);
    segs.push({ a: ROUTE[i], b: ROUTE[i + 1], len: l });
    total += l;
  }
  const routePoint = (t, out) => {
    let dd = t * total;
    for (const sg of segs) {
      if (dd <= sg.len) return out.lerpVectors(sg.a, sg.b, dd / sg.len);
      dd -= sg.len;
    }
    return out.copy(ROUTE[ROUTE.length - 1]);
  };
  // 分段色带:交流黄 → 直流绿
  const STOPS = [
    { t: 0, c: new THREE.Color(0xffd75e) },
    { t: 0.22, c: new THREE.Color(0xffd75e) },
    { t: 0.38, c: new THREE.Color(0xff9a4d) },
    { t: 0.5, c: new THREE.Color(0xff5030) },
    { t: 0.62, c: new THREE.Color(0x9fe8b5) },
    { t: 0.8, c: new THREE.Color(0x51e88c) },
    { t: 1, c: new THREE.Color(0x51e88c) },
  ];
  const phaseColor = (t) => {
    for (let i = 0; i < STOPS.length - 1; i++) {
      if (t <= STOPS[i + 1].t) {
        const k = (t - STOPS[i].t) / (STOPS[i + 1].t - STOPS[i].t);
        return STOPS[i].c.clone().lerp(STOPS[i + 1].c, k);
      }
    }
    return STOPS[STOPS.length - 1].c.clone();
  };

  const NP = 34;
  const pkt = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }), NP);
  g.add(pkt);
  const parts = [];
  const rnd = LX.textures.random(150);
  for (let i = 0; i < NP; i++) parts.push({ t: i / NP, sp: 0.055 + rnd() * 0.03 });
  const d6 = new THREE.Object3D();
  const pc6 = new THREE.Color();

  g.userData.tick = (dt, t) => {
    for (let i = 0; i < NP; i++) {
      const p = parts[i];
      p.t = (p.t + p.sp * dt) % 1;
      routePoint(p.t, d6.position);
      const c = phaseColor(p.t);
      // 交流段闪烁(正弦方向变化),直流段稳定
      const flicker = p.t < 0.3 ? (Math.sin(t * 22) > 0 ? 1 : 0.25) : 1;
      d6.scale.setScalar((0.7 + flicker * 0.35) * (0.8 + Math.sin(t * 5 + i * 2) * 0.15));
      d6.updateMatrix();
      pkt.setMatrixAt(i, d6.matrix);
      pkt.setColorAt(i, c);
    }
    pkt.instanceMatrix.needsUpdate = true;
    if (pkt.instanceColor) pkt.instanceColor.needsUpdate = true;

    // 开关管高频闪烁
    switchFet.material.emissive.setHex(Math.sin(t * 30) > 0 ? 0x2a5a78 : 0x101820);
    switchFet.material.emissiveIntensity = Math.sin(t * 30) > 0 ? 0.8 : 0.1;

    const el = document.getElementById('charger-status');
    if (el) {
      const lead = parts[0].t;
      const stage = lead < 0.28 ? 'AC 输入(方向每秒变化 50 次)'
        : lead < 0.42 ? '整流桥:四只二极管轮流导通,把交流变成脉动直流'
        : lead < 0.6 ? '高频开关 + 变压器:把高压脉动变成安全的低压高频电'
        : '滤波稳压:电容把纹波填平 → 干净的 20V 直流输出给电池充电';
      el.textContent = stage;
    }
  };
  return g;
};
