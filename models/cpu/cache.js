/* ============================================================
 * models/cpu/cache.js — 缓存命中 / 未命中对比
 * 层级排布(左→右):内存 DRAM → L3 → L2 → L1 → 寄存器。
 * 命中:数据球从 L1 直达寄存器,路径短、速度快、到位绿色 ✓ 闪。
 * 未命中:数据球从内存出发逐级搬运(慢),球体带脉冲光环 +
 * 进度条表示"等待",最终到寄存器。
 * UI 面板(data-node="cache")提供"模拟命中 / 模拟未命中"按钮;
 * 空闲 6 秒后自动交替演示。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.cache = {};

const MCH = LX.materials;

function levelBlock(w, h, d, mat, label) {
  const g = new THREE.Group();
  const body = LX.geo.rbox(w, h, d, mat, 0.015, 2);
  body.position.y = h / 2 + 0.03;
  g.add(body);
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const cg = cv.getContext('2d');
  cg.font = 'bold 40px "Segoe UI", monospace';
  cg.textAlign = 'center';
  cg.fillStyle = '#cfe3ff';
  cg.fillText(label, 128, 58);
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.62, 0.23, 1);
  sp.position.y = h + 0.28;
  g.add(sp);
  return g;
}

LX.models.cache.build = function () {
  const g = new THREE.Group();

  // 底板(内存总线)
  const slab = LX.geo.rbox(2.6, 0.06, 1.0, MCH.mat(0x1a2029, { metalness: 0.5, roughness: 0.5, roughnessMap: LX.textures.grain() }), 0.015, 1);
  slab.position.y = 0.03;
  g.add(slab);

  // 层级块:x 位置 — 内存最远,寄存器最近
  const levels = [
    { name: '内存', x: -1.05, w: 0.5, h: 0.3, mat: MCH.mat(0x1f2b1a, { metalness: 0.3, roughness: 0.6 }) },
    { name: 'L3', x: -0.5, w: 0.34, h: 0.2, mat: MCH.mat(0x20344a, { metalness: 0.5, roughness: 0.4 }) },
    { name: 'L2', x: -0.05, w: 0.26, h: 0.16, mat: MCH.mat(0x27405c, { metalness: 0.5, roughness: 0.38 }) },
    { name: 'L1', x: 0.36, w: 0.2, h: 0.12, mat: MCH.mat(0x2e4a6e, { metalness: 0.5, roughness: 0.36 }) },
    { name: '寄存器', x: 1.0, w: 0.26, h: 0.1, mat: MCH.mat(0x3a3f47, { metalness: 0.6, roughness: 0.35 }) },
  ];
  const pos = {};
  for (const lv of levels) {
    const b = levelBlock(lv.w, lv.h, 0.55, lv.mat, lv.name);
    b.position.set(lv.x, 0.06, 0);
    pos[lv.name] = new THREE.Vector3(lv.x, lv.h + 0.12, 0);
    g.add(b);
  }

  // 数据球(发光)
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x66d9ff, emissiveIntensity: 1.8, roughness: 0.3 }));
  orb.visible = false;
  g.add(orb);
  // 未命中等待:脉冲光环
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.008, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xffc14d, transparent: true, opacity: 0 }));
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  g.add(ring);
  // 未命中等待:进度条(等待时充能)
  const barBg = LX.geo.rbox(0.56, 0.024, 0.02, MCH.mat(0x10141c, { emissive: 0x000000 }), 0, 1);
  const bar = LX.geo.rbox(0.52, 0.014, 0.024,
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xffc14d, emissiveIntensity: 1.4 }), 0, 1);
  barBg.position.set(0, 0.62, 0);
  bar.position.set(0, 0.62, 0);
  barBg.visible = bar.visible = false;
  g.add(barBg, bar);

  // 到位确认:绿色 ✓ 光柱
  const confirmBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.5, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x51e88c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  confirmBeam.position.set(1.0, 0.35, 0);
  g.add(confirmBeam);

  /* ----- 场景脚本 ----- */
  const PATHS = {
    hit: {
      points: [pos['L1'].clone(), pos['寄存器'].clone()],
      duration: 0.9, from: 'L1',
    },
    miss: {
      points: [pos['内存'].clone(), pos['L3'].clone(), pos['L2'].clone(), pos['L1'].clone(), pos['寄存器'].clone()],
      duration: 4.2, from: '内存',
    },
  };
  let anim = null; // { path, t, duration, miss, done }
  let autoT = 4;   // 空闲自动演示计时
  let autoToggle = false;

  const curveOf = (points) => {
    const segs = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const len = a.distanceTo(b);
      segs.push({ a, b, len, start: total });
      total += len;
    }
    return { segs, total };
  };

  function start(kind) {
    const cfg = PATHS[kind];
    anim = { kind, curve: curveOf(cfg.points), t: 0, duration: cfg.duration, miss: kind === 'miss' };
    orb.visible = true;
    orb.material.emissive.setHex(kind === 'miss' ? 0xffc14d : 0x66d9ff);
    ring.visible = anim.miss;
    barBg.visible = bar.visible = anim.miss;
    barBg.position.set(0, 0.62, 0);
    bar.position.set(0, 0.62, 0);
    bar.scale.x = 0.001;
  }

  g.userData.tick = (dt) => {
    // 自动交替演示
    if (!anim) {
      autoT += dt;
      if (autoT > 5) { autoT = 0; autoToggle = !autoToggle; start(autoToggle ? 'miss' : 'hit'); }
    }
    if (!anim) return;
    anim.t += dt;
    const k = Math.min(anim.t / anim.duration, 1);
    // 未命中:每级之间"等一等"再搬(阶梯式推进)
    let prog = k;
    if (anim.miss) {
      const legs = anim.curve.segs.length;
      const leg = Math.min(Math.floor(k * legs), legs - 1);
      const localK = k * legs - leg;
      prog = (leg + localK * localK * 0.4 + localK * 0.6) / legs; // 每段起步缓
      // 逐级搬运时光标位置:当前 leg 的插值
      const seg = anim.curve.segs[leg];
      orb.position.lerpVectors(seg.a, seg.b, localK);
    } else {
      const { segs } = anim.curve;
      const seg = segs[0];
      orb.position.lerpVectors(seg.a, seg.b, k);
    }
    // 等待指示:脉冲光环 + 进度条
    if (anim.miss) {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(anim.t * 5));
      ring.position.copy(orb.position);
      ring.material.opacity = pulse;
      ring.scale.setScalar(1 + 0.5 * Math.sin(anim.t * 5));
      bar.scale.x = Math.max(prog, 0.001);
      bar.position.x = -0.26 + 0.26 * prog * 1.0;
      bar.material.emissiveIntensity = 0.8 + pulse;
    }
    // 到位
    if (k >= 1 && !anim.done) {
      anim.done = true;
      orb.visible = ring.visible = barBg.visible = bar.visible = false;
      if (anim.miss) {
        confirmBeam.material.color.setHex(0xffc14d);
      } else {
        confirmBeam.material.color.setHex(0x51e88c);
      }
      confirmBeam.material.opacity = 0.85;
      anim.cool = 1.1;
    }
    if (anim && anim.done) {
      anim.cool -= dt;
      confirmBeam.material.opacity = Math.max(0, anim.cool * 0.7);
      if (anim.cool <= 0) anim = null;
    }
  };

  // UI 对接(#cache-panel)
  g.userData.api = {
    simulate(kind) {
      start(kind === 'miss' ? 'miss' : 'hit');
      autoT = 0;
      const el = document.getElementById('cache-status');
      if (el) el.textContent = kind === 'miss'
        ? '未命中:数据从内存出发,经 L3 → L2 → L1 逐级搬运…(注意进度条与脉冲等待)'
        : '命中:数据就在 L1,直达寄存器——绿色确认表示瞬时完成';
    },
  };
  return g;
};
