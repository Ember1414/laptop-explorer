/* ============================================================
 * models/mainboard/wifiCard.js — 无线网卡
 * M.2 小卡(主控芯片 + 金手指)+ 天线馈线连到屏幕边框内的天线;
 * 电磁波:同心圆波纹从天线端扩散(发射)/汇聚(接收)。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.wifi = {};

const MW = LX.materials;

function wLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 72;
  const g = c.getContext('2d');
  g.font = 'bold 32px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 160, 48);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(0.95, 0.21, 1);
  return sp;
}

// 板载小卡(供主板挂载为 'wifi' 入口)
LX.models.wifi.buildCard = function () {
  const g = new THREE.Group();
  const card = LX.geo.rbox(0.62, 0.03, 0.28, MW.pcb(), 0.008, 1);
  card.position.set(-0.7, 0.05, 0.45);
  g.add(card);
  const ctrl = LX.geo.rbox(0.16, 0.024, 0.16, MW.chip(), 0.004, 1);
  ctrl.position.set(-0.82, 0.075, 0.45);
  g.add(ctrl);
  const fingers = LX.geo.rbox(0.05, 0.018, 0.2, MW.mat(0xc9a227, { metalness: 0.95, roughness: 0.2 }), 0, 1);
  fingers.position.set(-0.36, 0.048, 0.45);
  g.add(fingers);
  const standoff = LX.geo.cyl(0.016, 0.026, MW.mat(0x8a8f98, { metalness: 0.8, roughness: 0.3 }), 12);
  standoff.position.set(-0.98, 0.055, 0.45);
  g.add(standoff);
  return g;
};

LX.models.wifi.build = function () {
  const g = new THREE.Group();

  g.add(LX.models.wifi.buildCard());

  // 天线馈线(细线,从卡连向右上的屏幕边框天线)
  const feedMat = new THREE.MeshBasicMaterial({ color: 0x9aa8b8 });
  const feedPts = [[-0.68, 0.06, 0.45], [-0.5, 0.06, 0.62], [-0.1, 0.06, 0.8], [0.5, 0.35, 0.85], [1.1, 0.9, 0.8]];
  for (let i = 0; i < feedPts.length - 1; i++) {
    const a = new THREE.Vector3(...feedPts[i]), b = new THREE.Vector3(...feedPts[i + 1]);
    const len = a.distanceTo(b);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, len), feedMat);
    w.position.copy(a).add(b).multiplyScalar(0.5);
    w.lookAt(b);
    g.add(w);
  }
  // 天线(屏幕边框内的贴片天线)
  const antenna = LX.geo.rbox(0.05, 0.16, 0.03, MW.mat(0xc9a227, { metalness: 0.9, roughness: 0.3 }), 0.004, 1);
  antenna.position.set(1.1, 0.95, 0.8);
  g.add(antenna);
  const antLabel = wLabel('天线(屏幕边框内)', '#ffd75e');
  antLabel.position.set(1.1, 1.22, 0.8);
  g.add(antLabel);

  // 屏幕边框示意(细框)
  const lidEdge = LX.geo.rbox(0.06, 0.5, 0.04, MW.mat(0x8f97a2, { metalness: 0.7, roughness: 0.4 }), 0.006, 1);
  lidEdge.position.set(1.1, 0.95, 0.88);
  g.add(lidEdge);

  // 电磁波:同心圆波纹(从天线扩散)
  const WAVES = 5;
  const waves = [];
  const waveMatBase = { transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false };
  for (let i = 0; i < WAVES; i++) {
    const w = new THREE.Mesh(
      new THREE.TorusGeometry(0.12 + i * 0.14, 0.006, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0x66d9ff, ...waveMatBase }));
    w.position.set(1.1, 0.95, 0.8);
    w.rotation.x = 0.4;
    g.add(w);
    waves.push(w);
  }

  let phase = 0;

  g.userData.tick = (dt, t) => {
    phase += dt;
    // 波纹扩散:半径与透明度随相位循环
    for (let i = 0; i < WAVES; i++) {
      const k = ((phase * 0.7 + i / WAVES) % 1);
      const r = 0.1 + k * 0.75;
      waves[i].scale.setScalar(r / (0.12 + i * 0.14));
      waves[i].material.opacity = (1 - k) * 0.55;
    }
    // 数据脉冲沿馈线闪动
    feedMat.color.setHex(Math.sin(phase * 8) > 0 ? 0xb8d8ff : 0x5a7080);
  };

  return g;
};
