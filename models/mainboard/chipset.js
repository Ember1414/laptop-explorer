/* ============================================================
 * models/mainboard/chipset.js — 芯片组(PCH,"南桥")
 * 交通枢纽:中心 PCH 芯片向四周辐射数据流(发光粒子沿线流动),
 * 连接 CPU(上行)/USB / 无线网卡 / 音频编解码 各 I/O 设备块。
 * 数据包从 CPU 下发到各设备,或从设备汇聚回 CPU。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.chipset = {};

const MCH2 = LX.materials;

function chLabel(text, color, scale) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 80;
  const g = c.getContext('2d');
  g.font = 'bold 34px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 160, 52);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(scale || 1.0, (scale || 1.0) * 0.25, 1);
  return sp;
}

LX.models.chipset.build = function () {
  const g = new THREE.Group();

  // 基板
  const sub = LX.geo.rbox(2.6, 0.06, 1.9, MCH2.pcb(), 0.014, 2);
  sub.position.y = 0.03;
  g.add(sub);

  // 中心 PCH 芯片
  const pch = LX.geo.rbox(0.5, 0.07, 0.5, MCH2.chip(), 0.008, 1);
  pch.position.y = 0.065;
  const pchCap = LX.geo.rbox(0.42, 0.01, 0.42, MCH2.mat(0x565d68, { metalness: 0.7, roughness: 0.35 }), 0.004, 1);
  pchCap.position.y = 0.105;
  g.add(pch, pchCap);
  const pchLabel = chLabel('芯片组 PCH', '#8fd4ff', 0.75);
  pchLabel.position.set(0, 0.32, 0);
  g.add(pchLabel);

  // 四周设备块:CPU(上)/ USB(右)/ 无线网卡(下)/ 音频(左)
  const devices = [
    { name: 'CPU', color: 0x66d9ff, x: 0, z: -0.72, w: 0.42, d: 0.26 },
    { name: 'USB', color: 0xffd75e, x: 1.02, z: 0, w: 0.3, d: 0.4 },
    { name: 'WiFi', color: 0x9fe8b5, x: 0, z: 0.72, w: 0.36, d: 0.24 },
    { name: '音频', color: 0xc79fff, x: -1.02, z: 0, w: 0.3, d: 0.34 },
  ];
  const devBlocks = [];
  for (const dv of devices) {
    const blk = LX.geo.rbox(dv.w, 0.12, dv.d,
      MCH2.mat(0x2a2f38, { metalness: 0.5, roughness: 0.4, roughnessMap: LX.textures.grain() }), 0.008, 1);
    blk.position.set(dv.x, 0.09, dv.z);
    const lab = chLabel(dv.name, '#' + dv.color.toString(16).padStart(6, '0'), 0.52);
    lab.position.set(dv.x, 0.32, dv.z);
    g.add(blk, lab);
    devBlocks.push({ ...dv, blk });
  }

  // 总线走线:从 PCH 到各设备的 L 形线路(发光线框,数据包沿线流动)
  const routes = [];
  const busMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35 });
  for (const dv of devices) {
    const grp = new THREE.Group();
    const mkSeg = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.008, 0.024), busMat(dv.color));
      seg.position.set((x0 + x1) / 2, 0.062, (z0 + z1) / 2);
      seg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      grp.add(seg);
      return { mesh: seg, a: new THREE.Vector2(x0, z0), b: new THREE.Vector2(x1, z1), len };
    };
    // L 形:先沿 x 到设备 x,再沿 z
    const segs = [mkSeg(0, 0, dv.x, 0)];
    if (Math.abs(dv.z) > 0.01) segs.push(mkSeg(dv.x, 0, dv.x, dv.z));
    routes.push({ dev: dv.name, color: dv.color, segs, total: segs.reduce((a, s) => a + s.len, 0) });
    g.add(grp);
  }

  /* ----- 数据包粒子:沿路线流动(往返:下发/上行) ----- */
  const NP = 26;
  const pktMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pktMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.012, 0.03), pktMat, NP);
  g.add(pktMesh);
  const packets = [];
  const rnd = LX.textures.random(140);
  for (let i = 0; i < NP; i++) {
    packets.push({
      route: Math.floor(rnd() * routes.length),
      t: rnd(),                      // 0..1 沿线
      dir: rnd() < 0.55 ? 1 : -1,    // 1 下发(CPU→设备)| -1 上行
      sp: 0.25 + rnd() * 0.2,
    });
  }
  const pd = new THREE.Object3D();
  const pc = new THREE.Color();

  g.userData.tick = (dt, t) => {
    for (let i = 0; i < NP; i++) {
      const p = packets[i];
      p.t += p.sp * dt;
      if (p.t > 1) { p.t = 0; p.route = Math.floor(Math.random() * routes.length); p.dir = Math.random() < 0.55 ? 1 : -1; }
      const r = routes[p.route];
      const tt = p.dir === 1 ? p.t : 1 - p.t;
      // 沿 L 形路线定位
      let d2 = tt * r.total;
      const v2 = new THREE.Vector2(0, 0);
      for (const sg of r.segs) {
        if (d2 <= sg.len) { v2.lerpVectors(sg.a, sg.b, d2 / sg.len); break; }
        d2 -= sg.len;
        v2.copy(sg.b);
      }
      pd.position.set(v2.x, 0.075, v2.y);
      pd.scale.setScalar(0.8 + Math.sin(t * 7 + i * 3) * 0.25);
      pd.updateMatrix();
      pktMesh.setMatrixAt(i, pd.matrix);
      pc.setHex(r.color);
      pktMesh.setColorAt(i, pc);
    }
    pktMesh.instanceMatrix.needsUpdate = true;
    if (pktMesh.instanceColor) pktMesh.instanceColor.needsUpdate = true;

    // 设备块轻微脉动(有数据往来时)
    for (const dv of devBlocks) {
      dv.blk.material.emissive.setHex(dv.color);
      dv.blk.material.emissiveIntensity = 0.12 + Math.abs(Math.sin(t * 2 + dv.x)) * 0.15;
    }
  };

  return g;
};
