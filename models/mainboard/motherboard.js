/* ============================================================
 * models/mainboard/motherboard.js — 主板 v2(全宽板,对标真机拆解)
 * 板身 29.8 × 10.2 cm,横贯机身后部;板边缘自带 I/O 座,
 * 与两侧墙板开孔逐一对齐(HDMI/USB-A 左缘,USB-C×2/3.5mm 右缘)。
 * 布线真实特征:CPU BGA 扇出、内存蛇形等长总线、差分对、
 * 粗电源路径、边缘过孔缝合、丝印位号。
 * 后中缺口容纳离心风扇(风口对齐后墙散热槽)。
 * 命名组(子节点入口):cpu / gpu / chipset / wifi / codec / rom / vrm /
 * memory(板上 LPDDR)/ m2(板上 M.2 总成)。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.motherboard = {};

const M = LX.materials;

const BW = 2.98, BD = 1.02; // 板宽/深(局部单位,1 单位 = 10cm)

function mkMats() {
  return {
    cap: M.mat(0x2b2f36, { metalness: 0.55, roughness: 0.4, roughnessMap: LX.textures.grain() }),
    capTop: M.mat(0x33383f, { metalness: 0.5, roughness: 0.45 }),
    groove: M.mat(0x101318, { metalness: 0.4, roughness: 0.6 }),
    inductor: M.mat(0x1b1d22, { metalness: 0.3, roughness: 0.75, roughnessMap: LX.textures.grain() }),
    mosfet: M.mat(0x1f2329, { metalness: 0.45, roughness: 0.4 }),
    substrate: M.mat(0x35604a, { metalness: 0.2, roughness: 0.6 }),
    gold: M.mat(0xc9a227, { metalness: 0.9, roughness: 0.3 }),
    passiveSilver: M.mat(0xb0b4ba, { metalness: 0.8, roughness: 0.35 }),
    passiveDark: M.mat(0x2a2e35, { metalness: 0.4, roughness: 0.5 }),
    socket: M.mat(0xe8e2d4, { metalness: 0.1, roughness: 0.6 }),
    dram: M.mat(0x171a20, { metalness: 0.25, roughness: 0.55, roughnessMap: LX.textures.grain() }),
    shell: M.mat(0x3a4048, { metalness: 0.75, roughness: 0.35 }),
    tongue: M.mat(0x14171c, { metalness: 0.3, roughness: 0.5 }),
  };
}

/* ---------- 元件工厂 ---------- */
LX.models.motherboard.capacitor = function (mats, r = 0.02, h = 0.05) {
  const g = new THREE.Group();
  const body = LX.geo.cyl(r, h, mats.cap, 14);
  body.position.y = h / 2;
  const rim = LX.geo.cyl(r * 0.78, 0.002, mats.capTop, 14);
  rim.position.y = h - 0.0005;
  const slotL = LX.geo.rbox(r * 1.3, 0.003, r * 0.22, mats.groove, 0, 1);
  slotL.position.y = h + 0.0002;
  const slotS = LX.geo.rbox(r * 0.22, 0.003, r * 1.3, mats.groove, 0, 1);
  slotS.position.y = h + 0.0002;
  g.add(body, rim, slotL, slotS);
  return g;
};

LX.models.motherboard.inductor = function (mats, r = 0.045, h = 0.05) {
  const g = new THREE.Group();
  const body = LX.geo.rbox(r * 2, h, r * 1.6, mats.inductor, 0.008, 1);
  body.position.y = h / 2;
  const winding = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, 0.007, 8, 20), M.copper());
  winding.rotation.x = Math.PI / 2;
  winding.position.y = h + 0.002;
  g.add(body, winding);
  return g;
};

LX.models.motherboard.mosfet = function (mats, w = 0.08, h = 0.02, d = 0.05) {
  const g = new THREE.Group();
  const body = LX.geo.rbox(w, h, d, mats.mosfet, 0.004, 1);
  body.position.y = h / 2;
  const pin = LX.geo.rbox(w * 0.9, 0.004, d * 0.35, M.copper(), 0, 1);
  pin.position.set(0, h + 0.001, -d * 0.2);
  g.add(body, pin);
  return g;
};

LX.models.motherboard.chipPackage = function (mats, size, dieRatio = 0.62) {
  const g = new THREE.Group();
  const substrate = LX.geo.rbox(size, 0.018, size, mats.substrate, 0.004, 1);
  substrate.position.y = 0.009;
  const die = LX.geo.rbox(size * dieRatio, 0.026, size * dieRatio, M.chip(), 0.003, 1);
  die.position.y = 0.031;
  const mkPads = (z, seed) => LX.instanced.build(
    new THREE.SphereGeometry(0.004, 6, 6), mats.gold,
    LX.instanced.jitterGrid({
      from: [-size / 2 + 0.015, 0.002, z],
      step: [size / 9, 0, 0], cols: 10, rows: 1,
      jitterP: 0.002, jitterR: 0, scaleRange: [0.9, 1.1], seed,
    }));
  g.add(substrate, die, mkPads(-size / 2 + 0.015, 5), mkPads(size / 2 - 0.015, 6));
  return g;
};

/* ---------- PCB 贴图:真实布线特征 ---------- */
function pcbTexture() {
  const W = 3000, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const X = (x) => (x + BW / 2) / BW * W;
  const Y = (z) => (BD / 2 - z) / BD * H; // flipY:画布顶部 = +z 前缘
  const rnd = LX.textures.random(7);

  // 阻焊层 + 纤维噪点
  g.fillStyle = '#134a2a';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${18 + rnd() * 26 | 0},${86 + rnd() * 44 | 0},${46 + rnd() * 30 | 0},0.09)`;
    g.fillRect(rnd() * W, rnd() * H, 3, 3);
  }
  // 大铜箔接地
  g.fillStyle = 'rgba(190,150,60,0.15)';
  const pours = [[0.2, 0.24, 0.6, 0.5], [-0.62, -0.2, 0.7, 0.55], [1.0, -0.18, 0.44, 0.5], [0.66, 0.12, 0.34, 0.34], [-1.15, 0.3, 0.3, 0.34]];
  for (const [cx, cz, w, d] of pours) g.fillRect(X(cx - w / 2), Y(cz + d / 2), w / BW * W, d / BD * H);

  const trace = (pts, w, col) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z))));
    g.stroke();
  };
  const T = (w) => `rgba(201,162,39,${0.5 + rnd() * 0.3})`;

  // 45° 折线:两段式(a→肘→b)
  const elbow = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    const s = Math.min(adx, adz);
    const mx = x0 + Math.sign(dx) * s, mz = z0 + Math.sign(dz) * s;
    return Math.abs(dx) > Math.abs(dz) ? [[x0, z0], [mx, z0], [x1, z1]] : [[x0, z0], [x0, mz], [x1, z1]];
  };
  // 平行总线(等距 n 条,带 45° 肘)
  const bus = (x0, z0, x1, z1, n, gap, w) => {
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap;
      trace(elbow(x0, z0 + off, x1, z1 + off), w, T(w));
    }
  };
  // 蛇形等长绕线(内存总线特征)
  const serp = (x0, z0, x1, z1, n, gap, amp, w) => {
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap;
      const pts = [[x0, z0 + off]];
      const seg = (x1 - x0) / 5;
      for (let s = 0; s < 5; s++) {
        const xx = x0 + seg * (s + 0.5);
        pts.push([xx, z0 + off + (s % 2 ? amp : -amp)]);
      }
      pts.push([x1, z1 + off]);
      trace(pts, w, T(w));
    }
  };
  // 差分对(两条紧贴)
  const pair = (x0, z0, x1, z1, w) => {
    trace(elbow(x0, z0, x1, z1), w, 'rgba(210,175,80,0.9)');
    trace(elbow(x0, z0 + 0.014, x1, z1 + 0.014), w, 'rgba(210,175,80,0.9)');
  };
  // CPU BGA 扇出(芯片南缘一排 45° 短出线 + 焊盘)
  const fanout = (cx, cz, n, span, len) => {
    for (let i = 0; i < n; i++) {
      const x = cx - span / 2 + (i / (n - 1)) * span;
      const dir = i < n / 2 ? -1 : 1;
      trace([[x, cz], [x + dir * len * 0.5, cz - len * 0.7], [x + dir * len, cz - len]], 2.2, T(2.2));
      g.fillStyle = 'rgba(222,180,96,0.9)';
      g.beginPath(); g.arc(X(x), Y(cz), 3.5, 0, 7); g.fill();
    }
  };

  /* --- 走线网络 --- */
  fanout(0.2, 0.02, 16, 0.44, 0.07);                                  // CPU BGA 扇出
  serp(0.02, 0.34, -0.36, 0.3, 16, 0.011, 0.02, 2);                   // 内存总线(蛇形等长)
  bus(0.42, 0.06, 0.66, 0.1, 8, 0.012, 2.2);                          // CPU → PCH
  for (let i = 0; i < 4; i++) pair(-0.2 - i * 0.05, -0.12, -0.52 - i * 0.04, -0.2, 2.4); // CPU↔GPU PCIe 差分对
  for (let i = 0; i < 3; i++) pair(0.78, 0.34, 0.45 - i * 0.05, 0.4, 2.2);               // PCH → M.2
  pair(-0.72, 0.2, -1.15, 0.14, 2.2); pair(-0.75, 0.24, -1.14, 0.2, 2.2);                // PCH ↔ WiFi
  pair(-0.98, 0.38, -1.2, 0.4, 2.2);                                                    // Codec → 耳放
  trace(elbow(-1.15, 0.42, -0.5, 0.34), 7, 'rgba(222,140,60,0.9)');                      // 电池粗电源
  trace(elbow(-0.5, 0.34, 0.3, 0.2), 7, 'rgba(222,140,60,0.9)');
  trace(elbow(0.3, 0.2, 0.95, -0.1), 7, 'rgba(222,140,60,0.9)');
  trace(elbow(0.95, -0.14, 0.35, -0.06), 6, 'rgba(222,140,60,0.9)');                     // VRM → CPU
  trace(elbow(0.9, -0.3, 0.5, -0.44), 5, 'rgba(222,140,60,0.9)');                        // VRM → GPU
  trace(elbow(0.02, -0.32, 0.28, -0.4), 3.5, T(3.5));                                    // 风扇转速线
  trace(elbow(-0.72, 0.46, -0.98, 0.42), 3, T(3));                                       // 扬声器 L 音频线
  trace(elbow(0.05, 0.46, -0.5, 0.44), 3, T(3));                                         // 扬声器 R 音频线
  bus(-1.4, -0.24, -1.44, -0.34, 6, 0.02, 2);                                            // HDMI 引出
  bus(1.4, -0.26, 1.44, -0.3, 5, 0.018, 2);                                              // USB-C 引出

  // 过孔:边缘缝合两排 + 随机 60
  g.fillStyle = 'rgba(150,116,40,0.9)';
  for (let i = 0; i < 40; i++) {
    g.beginPath(); g.arc(X(-1.44 + i * 0.074), Y(0.485), 3.5, 0, 7); g.fill();
    g.beginPath(); g.arc(X(-1.44 + i * 0.074), Y(-0.485), 3.5, 0, 7); g.fill();
  }
  for (let i = 0; i < 60; i++) {
    g.beginPath(); g.arc(X(-1.4 + rnd() * 2.8), Y(-0.45 + rnd() * 0.9), 3.5, 0, 7); g.fill();
  }
  // 连接器金手指焊盘
  g.fillStyle = 'rgba(222,180,96,0.95)';
  const pads = [[-1.15, 0.47, 0.1, 0.05], [0.02, -0.35, 0.07, 0.05], [-0.75, 0.49, 0.07, 0.05], [0.05, 0.49, 0.07, 0.05], [0.42, 0.41, 0.06, 0.2]];
  for (const [x, z, w, d] of pads) g.fillRect(X(x - w / 2), Y(z + d / 2), w / BW * W, d / BD * H);

  // 丝印
  g.fillStyle = 'rgba(235,240,235,0.85)';
  g.font = '600 24px monospace';
  g.fillText('EMBER MB R3.0 · 14G', X(-1.44), Y(0.42));
  g.font = '600 16px monospace';
  g.fillText('94V-0  e1  2112', X(-1.44), Y(-0.44));
  const refs = [['U1', 0.2, -0.06], ['U2', -0.62, -0.44], ['U3', 0.66, -0.06], ['U4', -0.5, 0.12], ['U5', -0.95, -0.4], ['U6', -1.28, 0.14], ['U7', 1.2, 0.28], ['PU1', 1.05, -0.36], ['JBAT1', -1.15, 0.4], ['JFAN1', 0.02, -0.3], ['JSPK1', -0.82, 0.5], ['JSPK2', 0.05, 0.42], ['JDP1', -1.2, -0.38], ['U9', 1.3, -0.3], ['U10', -1.02, 0.38], ['U11', 0.0, 0.38], ['RTC1', 1.32, 0.0], ['JKBD1', -1.2, 0.42], ['JTP1', -0.2, 0.14], ['U7', 1.32, 0.3]];
  g.font = '600 15px monospace';
  g.fillStyle = 'rgba(235,240,235,0.8)';
  g.fillText('M2_1 · 2280 SSD(先斜插后压平)', X(0.72), Y(0.28));
  g.fillText('LPDDR5 · 板载焊接(不可插拔)', X(-0.66), Y(0.06));
  for (const [t, x, z] of refs) g.fillText(t, X(x), Y(z));
  // 板标 + 网络名丝印
  g.font = 'bold 34px monospace';
  g.fillStyle = 'rgba(235,240,235,0.9)';
  g.fillText('EMBER', X(-1.36), Y(-0.36));
  g.font = '600 13px monospace';
  g.fillStyle = 'rgba(235,240,235,0.7)';
  g.fillText('VCCORE', X(0.6), Y(-0.2));
  g.fillText('PCIE0', X(-0.35), Y(-0.08));
  g.fillText('TP1..TP6', X(0.35), Y(-0.42));

  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 8;
  tex.repeat.set(1 / BW, 1 / BD);
  tex.offset.set(0.5, 0.5);
  return tex;
}

/* ---------- 板轮廓:全宽圆角矩形,后中留风扇缺口 ---------- */
function boardOutline() {
  const s = new THREE.Shape();
  const w = 1.49, d = 0.51, r = 0.06;
  s.moveTo(-w + r, -d);
  s.lineTo(0.0, -d);                 // 后缘左段
  s.lineTo(0.0, -0.18);              // 风扇缺口
  s.lineTo(0.72, -0.18);
  s.lineTo(0.72, -d);
  s.lineTo(w - r, -d);               // 后缘右段
  s.quadraticCurveTo(w, -d, w, -d + r);
  s.lineTo(w, d - r);
  s.quadraticCurveTo(w, d, w - r, d);
  s.lineTo(-w + r, d);
  s.quadraticCurveTo(-w, d, -w, d - r);
  s.lineTo(-w, -d + r);
  s.quadraticCurveTo(-w, -d, -w + r, -d);
  s.closePath();
  return s;
}

/* ---------- 主板模型 ---------- */
LX.models.motherboard.build = function () {
  const mats = mkMats();
  const g = new THREE.Group();

  const geo = new THREE.ExtrudeGeometry(boardOutline(), {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1,
    curveSegments: 8,
  });
  geo.rotateX(Math.PI / 2);
  const board = new THREE.Mesh(geo, M.mat(0xffffff, { map: pcbTexture(), metalness: 0.25, roughness: 0.55 }));
  board.position.y = 0.055;
  g.add(board);

  // PCB 边缘分层(真机压合截面:铜层条纹沿四边可见)
  const edgeCv = document.createElement('canvas');
  edgeCv.width = 256; edgeCv.height = 32;
  const eg = edgeCv.getContext('2d');
  eg.fillStyle = '#0e3a20'; eg.fillRect(0, 0, 256, 32);
  [6, 13, 20, 26].forEach((y, i) => {
    eg.fillStyle = i % 2 ? 'rgba(201,162,39,0.85)' : 'rgba(10,30,18,0.9)';
    eg.fillRect(0, y, 256, 2.5);
  });
  const edgeTex = new THREE.CanvasTexture(edgeCv);
  edgeTex.encoding = THREE.sRGBEncoding;
  edgeTex.wrapS = THREE.RepeatWrapping;
  edgeTex.repeat.set(10, 1);
  const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTex, metalness: 0.4, roughness: 0.5 });
  const edgeNS = LX.geo.rbox(BW, 0.042, 0.005, edgeMat, 0, 1);
  edgeNS.position.set(0, 0.032, -BD / 2 - 0.001);
  const edgeNS2 = LX.geo.rbox(BW, 0.042, 0.005, edgeMat, 0, 1);
  edgeNS2.position.set(0, 0.032, BD / 2 + 0.001);
  const edgeEW = LX.geo.rbox(0.005, 0.042, BD, edgeMat, 0, 1);
  edgeEW.position.set(-BW / 2 - 0.001, 0.032, 0);
  const edgeEW2 = LX.geo.rbox(0.005, 0.042, BD, edgeMat, 0, 1);
  edgeEW2.position.set(BW / 2 + 0.001, 0.032, 0);
  g.add(edgeNS, edgeNS2, edgeEW, edgeEW2);

  // 安装孔 ×6
  for (const [hx, hz] of [[-1.4, -0.43], [1.4, -0.43], [-1.4, 0.43], [1.4, 0.43], [-0.7, -0.43], [0.95, 0.43]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 8, 20), mats.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(hx, 0.052, hz);
    const hole = LX.geo.cyl(0.02, 0.052, M.dark(), 12);
    hole.position.set(hx, 0.028, hz);
    g.add(ring, hole);
  }

  /* ----- 后排:GPU | CPU | VRM(风扇在缺口内,由装配层放置) ----- */
  const cpu = LX.models.cpu.package();
  cpu.name = 'cpu';
  cpu.rotation.y = Math.PI / 2;
  cpu.scale.setScalar(0.32);
  cpu.position.set(0.2, 0.05, 0.24);

  const gpuGrp = LX.models.gpu.build();
  gpuGrp.name = 'gpu';
  gpuGrp.scale.setScalar(0.55);
  gpuGrp.position.set(-0.62, 0.05, -0.2);

  // CPU VRM 三相(板右段):3 电感 + 6 MOSFET + 5 电容 + 控制 IC
  const vrm = new THREE.Group();
  vrm.name = 'vrm';
  const rnd = LX.textures.random(31);
  for (let i = 0; i < 3; i++) {
    const ind = LX.models.motherboard.inductor(mats, 0.045, 0.05);
    ind.position.set(0.95 + i * 0.1 + (rnd() - 0.5) * 0.008, 0.05, -0.3);
    vrm.add(ind);
  }
  for (let i = 0; i < 6; i++) {
    const mf = LX.models.motherboard.mosfet(mats);
    mf.position.set(0.92 + (i % 3) * 0.12 + (rnd() - 0.5) * 0.008, 0.05, i < 3 ? -0.18 : -0.08);
    mf.rotation.y = (rnd() - 0.5) * 0.05;
    vrm.add(mf);
  }
  for (let i = 0; i < 5; i++) {
    const cap = LX.models.motherboard.capacitor(mats, 0.02, 0.045);
    cap.position.set(0.92 + i * 0.08, 0.05, 0.0);
    vrm.add(cap);
  }
  const vrmCtrl = LX.geo.rbox(0.12, 0.02, 0.1, M.chip(), 0.003, 1);
  vrmCtrl.position.set(1.08, 0.06, -0.24);
  vrm.add(vrmCtrl);
  g.add(cpu, gpuGrp, vrm);

  /* ----- 前排:LPDDR | PCH | M.2 | BIOS | WiFi | Codec ----- */
  // 内存:LPDDR5 ×4 焊在 CPU 紧左侧(真机布局;白色激光丝印顶面,深板上即可辨认)
  const mem = new THREE.Group();
  mem.name = 'memory';
  const memSilk = (() => {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 80;
    const sg = cv.getContext('2d');
    sg.fillStyle = '#1d2129'; sg.fillRect(0, 0, 128, 80);
    sg.fillStyle = '#c8d2dc';
    sg.font = 'bold 22px monospace'; sg.textAlign = 'left';
    sg.fillText('LXDDR5', 10, 34);
    sg.font = '15px monospace';
    sg.fillText('8GB LPDDR5', 10, 60);
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  })();
  const memSilkGeo = new THREE.PlaneGeometry(0.19, 0.11);
  const memSilkMat = new THREE.MeshBasicMaterial({ map: memSilk });
  for (let i = 0; i < 4; i++) {
    const px = -0.34 + (i % 2) * 0.3, pz = 0.12 + Math.floor(i / 2) * 0.2;
    const pkg = LX.geo.rbox(0.24, 0.022, 0.15, mats.dram, 0.005, 1);
    pkg.position.set(px, 0.062, pz);
    const silk = new THREE.Mesh(memSilkGeo, memSilkMat);
    silk.rotation.x = -Math.PI / 2;
    silk.position.set(px, 0.0745, pz);
    mem.add(pkg, silk);
  }
  g.add(mem);

  const pch = LX.models.motherboard.chipPackage(mats, 0.3, 0.7);
  pch.name = 'chipset';
  pch.position.set(0.66, 0.05, 0.12);
  g.add(pch);

  const m2 = new THREE.Group();
  m2.name = 'm2';
  const m2conn = LX.geo.rbox(0.045, 0.018, 0.2, mats.mosfet, 0.003, 1);
  m2conn.position.set(0.42, 0.062, 0.4);
  const m2pins = LX.geo.rbox(0.03, 0.005, 0.16, mats.gold, 0, 1);
  m2pins.position.set(0.435, 0.058, 0.4);
  const standoff = LX.geo.cyl(0.016, 0.018, M.mat(0x565d68, { metalness: 0.8, roughness: 0.3 }), 12);
  standoff.position.set(1.14, 0.06, 0.4);
  const ssd = LX.models.ssd.build();
  ssd.rotation.y = -Math.PI / 2;
  ssd.position.set(0.78, 0.075, 0.4);
  m2.add(m2conn, m2pins, standoff, ssd);
  g.add(m2);

  const romChip = LX.models.rom.chip();
  romChip.name = 'rom';
  romChip.scale.setScalar(0.9);
  romChip.position.set(1.32, 0.055, 0.38);
  romChip.rotation.y = Math.PI / 2;
  g.add(romChip);

  const wifi = LX.models.wifi.buildCard();
  wifi.name = 'wifi';
  wifi.scale.setScalar(0.55);
  wifi.position.set(-0.587, 0.05, 0.0525);
  g.add(wifi);

  const codec = LX.models.audioCodec.buildChip();
  codec.name = 'codec';
  codec.scale.setScalar(0.55);
  codec.position.set(-1.26, 0.05, 0.3);
  g.add(codec);

  /* ----- 板缘 I/O 座(与墙板开孔逐一对齐;local z + 0.52 = world z) ----- */
  const mkRecept = (x, z, w, d, tongueW, tongueD) => {
    const shell = LX.geo.rbox(0.09, 0.05, d, mats.shell, 0.004, 1);
    shell.position.set(x, 0.055, z);
    const tg = LX.geo.rbox(tongueW, 0.011, tongueD, mats.tongue, 0, 1);
    tg.position.set(x + Math.sign(x) * 0.012, 0.052, z);
    g.add(shell, tg);
    // 过桥:填满板缘到墙板的间隙
    const bridge = LX.geo.rbox(0.08, 0.045, d * 0.7, mats.tongue, 0, 1);
    bridge.position.set(Math.sign(x) * 1.52, 0.055, z);
    g.add(bridge);
  };
  mkRecept(-1.44, -0.30, 0.06, 0.26, 0.05, 0.18);  // HDMI(左墙 z-0.82)
  mkRecept(-1.44, 0.08, 0.06, 0.13, 0.045, 0.09);  // USB-A(左墙 z-0.44)
  mkRecept(-1.44, 0.40, 0.06, 0.13, 0.045, 0.09);  // USB-A(左墙 z-0.12)
  mkRecept(1.44, -0.30, 0.06, 0.115, 0.05, 0.08);  // USB-C(右墙 z-0.82,充电口)
  mkRecept(1.44, 0.0, 0.06, 0.115, 0.05, 0.08);    // USB-C(右墙 z-0.52)
  const jack = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 18),
    M.mat(0x8a8f98, { metalness: 0.9, roughness: 0.3 }));
  jack.rotation.y = Math.PI / 2;
  jack.position.set(1.44, 0.055, 0.47);
  const jackIn = LX.geo.cyl(0.016, 0.03, M.dark(), 12);
  jackIn.rotation.z = Math.PI / 2;
  jackIn.position.set(1.44, 0.055, 0.47);
  const jackBridge = LX.geo.rbox(0.08, 0.04, 0.07, mats.tongue, 0, 1);
  jackBridge.position.set(1.52, 0.055, 0.47);
  g.add(jack, jackIn, jackBridge);

  /* ----- 边缘连接器:电池 / 充电 IC / 保险丝 / 风扇 / 扬声器 ----- */
  const batConn = new THREE.Group();
  const bcBody = LX.geo.rbox(0.1, 0.02, 0.055, mats.socket, 0.003, 1);
  bcBody.position.set(-1.15, 0.062, 0.47);
  batConn.add(bcBody);
  const batPinT = [];
  for (let i = 0; i < 6; i++) batPinT.push({ p: [-1.19 + i * 0.016, 0.058, 0.47], r: [0, 0, 0] });
  batConn.add(LX.instanced.build(new THREE.BoxGeometry(0.008, 0.006, 0.03), mats.gold, batPinT));
  const chargeIc = LX.geo.rbox(0.12, 0.02, 0.1, M.chip(), 0.003, 1);
  chargeIc.position.set(-0.95, 0.06, 0.44);
  const fuse = LX.geo.rbox(0.07, 0.012, 0.024, mats.passiveSilver, 0.002, 1);
  fuse.position.set(-1.32, 0.058, 0.44);
  g.add(batConn, chargeIc, fuse);

  // POST 诊断 QLED ×4(CPU/DRAM/VGA/BOOT,顺序点亮)
  const qledDefs = [['CPU', 0x4cc2ff], ['DRAM', 0xffd75e], ['VGA', 0x51e88c], ['BOOT', 0xff9a4d]];
  const qledMats = qledDefs.map(() => new THREE.MeshStandardMaterial({ color: 0x14181f, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.3 }));
  qledDefs.forEach(([name, col], i) => {
    qledMats[i].userData.qcol = col;
    const q = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.024), qledMats[i]);
    q.position.set(0.62 + i * 0.05, 0.058, -0.09);
    const ql = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.003, 0.004), M.mat(0x14171c, { roughness: 0.7 }));
    ql.position.set(0.62 + i * 0.05, 0.053, -0.117);
    g.add(q, ql);
  });
  // 晶振 ×2 + 铁氧体磁珠
  for (const [cx, cz] of [[0.48, 0.02], [-1.18, -0.02]]) {
    const xtal = LX.geo.cyl(0.014, 0.024, M.mat(0xc9ccd2, { metalness: 0.9, roughness: 0.25 }), 14);
    xtal.rotation.z = Math.PI / 2;
    xtal.position.set(cx, 0.062, cz);
    g.add(xtal);
  }
  const ferrite = LX.geo.rbox(0.036, 0.024, 0.024, M.mat(0x14171c, { roughness: 0.7 }), 0.004, 1);
  ferrite.position.set(0.6, 0.062, -0.16);
  // 聚合物电容排(VRM 输出)
  for (let i = 0; i < 5; i++) {
    const pc = LX.geo.cyl(0.013, 0.02, M.mat(0x1f2329, { metalness: 0.4, roughness: 0.35 }), 12);
    pc.position.set(0.9 + i * 0.07, 0.06, 0.16);
    const pcMark = LX.geo.rbox(0.014, 0.002, 0.005, M.mat(0xc9ccd2, { metalness: 0.6, roughness: 0.4 }), 0, 1);
    pcMark.position.set(0.9 + i * 0.07, 0.071, 0.16);
    g.add(pc, pcMark);
  }
  // 序列号条码贴纸
  const serCv = document.createElement('canvas');
  serCv.width = 256; serCv.height = 96;
  const serg = serCv.getContext('2d');
  serg.fillStyle = '#dfe3e8'; serg.fillRect(0, 0, 256, 96);
  serg.fillStyle = '#2b2f36';
  serg.font = 'bold 16px monospace';
  serg.fillText('EMBER14-MB-20260913', 10, 24);
  for (let i = 0; i < 60; i++) if (Math.random() > 0.4) serg.fillRect(10 + i * 4, 36, 2, 34);
  serg.font = '12px monospace';
  serg.fillText('S/N 4CX0913X7P', 10, 86);
  const serTex = new THREE.CanvasTexture(serCv);
  serTex.encoding = THREE.sRGBEncoding;
  const serialSticker = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.075),
    new THREE.MeshStandardMaterial({ map: serTex, roughness: 0.6, metalness: 0.05 }));
  serialSticker.rotation.x = -Math.PI / 2;
  serialSticker.position.set(0.95, 0.0712, 0.24);
  g.add(serialSticker);
  // WiFi IPEX 天线座 ×2 + 测试点 TP ×6
  for (const [ix, iz] of [[-0.8, -0.25], [-0.8, -0.31]]) {
    const ipex = LX.geo.cyl(0.012, 0.008, mats.gold, 12);
    ipex.position.set(ix, 0.062, iz);
    g.add(ipex);
  }
  const tpT = [];
  for (let i = 0; i < 6; i++) tpT.push({ p: [-0.5 + i * 0.2, 0.056, -0.46], r: [0, 0, 0] });
  g.add(LX.instanced.build(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 10), mats.gold, tpT));

  const fanConn = LX.geo.rbox(0.06, 0.018, 0.05, mats.socket, 0.002, 1);
  fanConn.position.set(0.02, 0.06, -0.35);
  const fanPinT = [];
  for (let i = 0; i < 4; i++) fanPinT.push({ p: [-0.005 + i * 0.016, 0.058, -0.35], r: [0, 0, 0] });
  g.add(fanConn, LX.instanced.build(new THREE.BoxGeometry(0.007, 0.006, 0.026), mats.gold, fanPinT));

  for (const sx of [-0.75, 0.05]) {
    const spkConn = LX.geo.rbox(0.07, 0.018, 0.05, mats.socket, 0.002, 1);
    spkConn.position.set(sx, 0.06, 0.49);
    const spkPinT = [];
    for (let i = 0; i < 3; i++) spkPinT.push({ p: [sx - 0.02 + i * 0.02, 0.058, 0.49], r: [0, 0, 0] });
    g.add(spkConn, LX.instanced.build(new THREE.BoxGeometry(0.007, 0.006, 0.024), mats.gold, spkPinT));
  }

  /* ----- 补充元件:eDP 显示排线座 / RTC 纽扣电池 / 键盘·触控板 FPC 座 /
     USB-C 重定时器 / 耳放 / TPM 安全芯片 / M.2 固定螺丝 ----- */
  const edp = LX.geo.rbox(0.26, 0.02, 0.05, mats.socket, 0.003, 1);
  edp.position.set(-1.2, 0.06, -0.3);
  const edpRibbon = LX.geo.rbox(0.2, 0.004, 0.09, mats.tongue, 0, 1);
  edpRibbon.position.set(-1.2, 0.052, -0.46);
  const rtc = LX.geo.cyl(0.06, 0.02, M.mat(0xc9ccd2, { metalness: 0.9, roughness: 0.25 }), 20);
  rtc.position.set(1.32, 0.075, -0.08);
  const rtcHolder = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 24), M.mat(0x565d68, { metalness: 0.7, roughness: 0.35 }));
  rtcHolder.rotation.x = Math.PI / 2;
  rtcHolder.position.set(1.32, 0.062, -0.08);
  const kbFpc = LX.geo.rbox(0.16, 0.018, 0.04, mats.socket, 0.002, 1);
  kbFpc.position.set(-1.2, 0.06, 0.49);
  const tpFpc = LX.geo.rbox(0.12, 0.018, 0.04, mats.socket, 0.002, 1);
  tpFpc.position.set(-0.2, 0.06, 0.2);
  const retimer = LX.geo.rbox(0.12, 0.02, 0.12, M.chip(), 0.003, 1);
  retimer.position.set(1.3, 0.06, -0.42);
  const headAmp = LX.geo.rbox(0.1, 0.018, 0.1, M.chip(), 0.003, 1);
  headAmp.position.set(-1.02, 0.06, 0.44);
  const tpm = LX.geo.rbox(0.08, 0.016, 0.08, M.chip(), 0.003, 1);
  tpm.position.set(0.0, 0.058, 0.44);
  const m2Screw = LX.geo.cyl(0.012, 0.006, M.mat(0x9aa2ad, { metalness: 0.9, roughness: 0.3 }), 12);
  m2Screw.position.set(0.45, 0.075, 0.42);
  g.add(edp, edpRibbon, rtc, rtcHolder, kbFpc, tpFpc, retimer, headAmp, tpm, m2Screw);

  /* ----- 贴片阻容矩阵(0402/0603 比例,分簇 + 扰动) ----- */
  const rnd2 = LX.textures.random(99);
  const mkPassiveRow = (cx, cz, n, gap, axis) => {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap;
      arr.push({
        p: axis === 'x'
          ? [cx + off + (rnd2() - 0.5) * 0.006, 0.054, cz + (rnd2() - 0.5) * 0.01]
          : [cx + (rnd2() - 0.5) * 0.01, 0.054, cz + off + (rnd2() - 0.5) * 0.006],
        r: [0, axis === 'x' ? (rnd2() - 0.5) * 0.2 : Math.PI / 2 + (rnd2() - 0.5) * 0.2, 0],
        s: 0.85 + rnd2() * 0.3,
      });
    }
    return arr;
  };
  const silverT = [
    ...mkPassiveRow(0.2, 0.0, 10, 0.032, 'x'),     // CPU BGA 下缘
    ...mkPassiveRow(-0.62, -0.46, 9, 0.036, 'x'),  // GPU 后缘
    ...mkPassiveRow(1.03, -0.2, 5, 0.03, 'z'),     // VRM
    ...mkPassiveRow(0.66, -0.06, 6, 0.03, 'x'),    // PCH 上缘
    ...mkPassiveRow(-0.5, 0.1, 6, 0.032, 'x'),     // LPDDR 上缘
    ...mkPassiveRow(-1.26, 0.12, 5, 0.03, 'x'),    // Codec 上缘
    ...mkPassiveRow(0.45, 0.16, 5, 0.034, 'x'),    // M.2 旁
    ...mkPassiveRow(1.2, 0.24, 4, 0.03, 'z'),      // BIOS 旁
    ...mkPassiveRow(-0.9, 0.4, 6, 0.03, 'x'),      // WiFi/Codec 间
  ];
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.024, 0.009, 0.013), mats.passiveSilver, silverT));
  const darkT = [
    ...mkPassiveRow(0.2, 0.02, 10, 0.032, 'x'),
    ...mkPassiveRow(-0.62, -0.44, 9, 0.036, 'x'),
    ...mkPassiveRow(0.95, -0.2, 5, 0.03, 'z'),
    ...mkPassiveRow(0.66, -0.08, 6, 0.03, 'x'),
    ...mkPassiveRow(-0.5, 0.08, 6, 0.032, 'x'),
    ...mkPassiveRow(-1.26, 0.1, 5, 0.03, 'x'),
    ...mkPassiveRow(0.45, 0.14, 5, 0.034, 'x'),
    ...mkPassiveRow(1.14, 0.24, 4, 0.03, 'z'),
    ...mkPassiveRow(-0.9, 0.38, 6, 0.03, 'x'),
  ];
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.024, 0.009, 0.013), mats.passiveDark, darkT));

  g.userData.tick = (dt, t) => {
    const on = Math.sin(t * 26) > 0;
    mats.mosfet.emissive.setHex(on ? 0x2a5a78 : 0x0a1218);
    mats.mosfet.emissiveIntensity = on ? 0.9 : 0.15;
    // QLED POST 序列:CPU → DRAM → VGA → BOOT 依次点亮,末段全亮
    const phase = (t * 0.8) % 5;
    const lit = Math.floor(phase);
    qledMats.forEach((qm, i) => {
      qm.emissive.setHex(qm.userData.qcol);
      qm.emissiveIntensity = phase >= 4 ? 1.4 : (i === lit ? 1.6 : 0.05);
    });
  };
  return g;
};
