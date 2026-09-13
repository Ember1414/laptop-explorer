/* ============================================================
 * models/io/speaker.js — 扬声器
 * build()          机身内的左右两单元外观(原有)
 * buildDetail()    下钻:线圈绕在磁体/轭铁上,通电产生磁场与永磁体
 *                  相互作用推动振膜;正弦波(频率/幅度可调)实时驱动
 *                  振膜振动速度与幅度。
 * 覆盖 UI:data-node="speaker"(频率/幅度滑块)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.speaker = {};

const MSP = LX.materials;

/* ---------- 机身内的左右两单元外观(真实结构:腔体 + 盆架 + 振膜 + 磁体) ---------- */
LX.models.speaker.build = function () {
  const g = new THREE.Group();
  const enclosure = MSP.mat(0x262b33, { metalness: 0.2, roughness: 0.8, roughnessMap: LX.textures.grain() });
  for (const x of [-1.4, 1.4]) {
    const unit = new THREE.Group();
    // 长条密闭腔体
    const box = LX.geo.rbox(0.2, 0.06, 0.9, enclosure, 0.012, 1);
    box.position.set(x, 0.03, 0);
    // 前端全频单元:盆架环 + 振膜锥盆 + 折环 + 防尘帽
    const basket = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 10, 26),
      MSP.mat(0x101318, { metalness: 0.5, roughness: 0.4 }));
    basket.rotation.x = Math.PI / 2;
    basket.position.set(x, 0.062, -0.22);
    const surround = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.006, 8, 26),
      MSP.mat(0x1c2026, { roughness: 0.6 }));
    surround.rotation.x = Math.PI / 2;
    surround.position.set(x, 0.064, -0.22);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.026, 24, 1, true),
      MSP.mat(0x1a1e26, { metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }));
    cone.rotation.x = Math.PI;
    cone.position.set(x, 0.058, -0.22);
    const dustCap = LX.geo.cyl(0.018, 0.01, MSP.mat(0x2e333b, { roughness: 0.4 }), 14);
    dustCap.position.set(x, 0.076, -0.22);
    // 腔体底部的磁体(外凸)
    const magnet = LX.geo.rbox(0.07, 0.02, 0.07, MSP.mat(0x2a2f38, { metalness: 0.6, roughness: 0.35 }), 0.004, 1);
    magnet.position.set(x, 0.012, -0.22);
    // 引出端子(接主板线缆)
    const terminal = LX.geo.rbox(0.03, 0.012, 0.02, MSP.mat(0xc9a227, { metalness: 0.9, roughness: 0.3 }), 0, 1);
    terminal.position.set(x, 0.064, 0.32);
    unit.add(box, basket, surround, cone, dustCap, magnet, terminal);
    if (x > 0) unit.name = 'speakerdetail'; // 右单元 = "扬声器单元"子节点入口
    g.add(unit);
  }
  return g;
};

/* ---------- 下钻:线圈 + 磁体 + 振膜 + 正弦驱动 ---------- */
LX.models.speaker.buildDetail = function () {
  const g = new THREE.Group();
  const mats = {
    magnet: MSP.mat(0x2a2f38, { metalness: 0.6, roughness: 0.35 }),
    pole: MSP.mat(0x8a8f98, { metalness: 0.85, roughness: 0.3 }),
    coil: MSP.mat(0xc9a06a, { metalness: 0.75, roughness: 0.35 }),
    frame: MSP.mat(0x262b33, { roughness: 0.6 }),
    cone: MSP.mat(0x2e333b, { roughness: 0.55, side: THREE.DoubleSide }),
  };

  // 底板
  const sub = LX.geo.rbox(1.5, 0.05, 1.1, MSP.pcb(), 0.014, 2);
  sub.position.y = 0.025;
  g.add(sub);

  // 磁体(圆柱)+ 中心极靴
  const magnet = LX.geo.cyl(0.3, 0.16, mats.magnet, 26);
  magnet.position.set(0, 0.13, 0);
  const pole = LX.geo.cyl(0.12, 0.2, mats.pole, 20);
  pole.position.set(0, 0.16, 0);
  g.add(magnet, pole);

  // 音圈:绕在磁体与极靴间隙的多圈环(6 圈)
  const coilGroup = new THREE.Group();
  coilGroup.position.set(0, 0.24, 0);
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.011, 8, 30), mats.coil);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = i * 0.028;
    coilGroup.add(ring);
  }
  // 音圈骨架
  const coilForm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.19, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide }));
  coilForm.position.y = 0.07;
  coilGroup.add(coilForm);
  g.add(coilGroup);

  // 振膜(锥形盆):随线圈上下振动
  const coneGroup = new THREE.Group();
  coneGroup.position.set(0, 0.38, 0);
  const coneGeo = new THREE.ConeGeometry(0.55, 0.16, 32, 1, true);
  const coneMesh = new THREE.Mesh(coneGeo, mats.cone);
  coneMesh.rotation.x = Math.PI;
  coneMesh.position.y = 0.05;
  coneGroup.add(coneMesh);
  const dustCap = LX.geo.cyl(0.13, 0.05, MSP.mat(0x3a3f47, { roughness: 0.4 }), 24);
  dustCap.position.y = 0.02;
  coneGroup.add(dustCap);
  // 折环(悬边)
  const surround = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 10, 36), MSP.mat(0x1c2026, { roughness: 0.6 }));
  surround.rotation.x = Math.PI / 2;
  surround.position.y = 0.02;
  coneGroup.add(surround);
  g.add(coneGroup);

  // 支撑架
  for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const arm = LX.geo.rbox(0.05, 0.3, 0.05, mats.frame, 0.005, 1);
    arm.position.set(Math.cos(a) * 0.52, 0.45, Math.sin(a) * 0.52);
    g.add(arm);
  }

  // 磁隙磁场环(音圈上下各一圈,发光强度 = 线圈电流 → 磁场相互作用的可视化)
  const fieldRings = [];
  const fieldMat = () => new THREE.MeshBasicMaterial({
    color: 0x66aaff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (const fy of [0.13, 0.36]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.007, 6, 36), fieldMat());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = fy;
    g.add(ring);
    fieldRings.push(ring);
  }

  // 正弦波指示器(面板:输入信号可视化)
  const waveCv = document.createElement('canvas');
  waveCv.width = 320; waveCv.height = 100;
  const wg = waveCv.getContext('2d');
  const waveTex = new THREE.CanvasTexture(waveCv);
  waveTex.encoding = THREE.sRGBEncoding;
  const wavePanel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.38),
    new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, opacity: 0.95 }));
  wavePanel.position.set(0, 0.95, 0.62);
  g.add(wavePanel);

  /* ----- 驱动参数 ----- */
  let freq = 2.2;       // Hz(可视化用的慢正弦,真实音频 20Hz-20kHz)
  let amp = 0.55;       // 0..1 振幅
  let phase = 0;
  const statusEl = () => document.getElementById('speaker-status');

  g.userData.tick = (dt, t) => {
    phase += dt * freq * Math.PI * 2;
    const s = Math.sin(phase) * amp;
    // 振膜 + 音圈随信号上下(频率滑块 → 相位推进速度 → 振动快慢)
    coneGroup.position.y = 0.38 + s * 0.055;
    coilGroup.position.y = 0.24 + s * 0.045;
    // 线圈"通电"发光与磁隙磁场环:随瞬时电流 i = sin·amp 变化(方向交变,亮度取绝对值)
    const cur = Math.abs(s);
    mats.coil.emissive.setHex(0x8a4a20);
    mats.coil.emissiveIntensity = 0.18 + cur * 1.4;
    fieldRings.forEach((r, i) => {
      r.material.opacity = cur * (i === 0 ? 0.55 : 0.4);
      r.scale.setScalar(1 + Math.sin(t * 3 + i * 1.7) * 0.03);
    });

    // 正弦波面板绘制:波形 + 当前采样点
    wg.fillStyle = '#060a08';
    wg.fillRect(0, 0, 320, 100);
    wg.strokeStyle = 'rgba(120,230,160,0.9)';
    wg.lineWidth = 2;
    wg.beginPath();
    for (let x = 0; x <= 320; x += 4) {
      const y = 50 - Math.sin(x / 320 * Math.PI * 4 + phase) * 34 * amp;
      if (x === 0) wg.moveTo(x, y); else wg.lineTo(x, y);
    }
    wg.stroke();
    const cx = ((phase / (Math.PI * 2)) % 1) * 320;
    wg.fillStyle = '#ffd75e';
    wg.beginPath(); wg.arc(cx % 320, 50 - Math.sin(cx / 320 * Math.PI * 4 + phase) * 34 * amp, 5, 0, 7); wg.fill();
    wg.font = '14px monospace';
    wg.fillStyle = 'rgba(160,220,180,0.8)';
    wg.fillText(`${(freq * 110).toFixed(0)} Hz  幅度 ${Math.round(amp * 100)}%`, 10, 20);
    waveTex.needsUpdate = true;

    const el = statusEl();
    if (el) el.textContent = `信号 ${(freq * 110).toFixed(0)}Hz · 音圈受力 F = B·i·L 随电流方向往复 → 振膜推动空气发声`;
  };

  g.userData.api = {
    setFreq(v01) { freq = 0.3 + Math.min(Math.max(v01, 0), 1) * 6; },
    setAmp(v01) { amp = Math.min(Math.max(v01, 0.05), 1); },
  };
  return g;
};
