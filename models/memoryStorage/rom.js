/* ============================================================
 * models/memoryStorage/rom.js — ROM/BIOS 开机自检(POST)
 * 场景内投影一块终端面板(CanvasTexture 逐帧绘制),
 * 自检清单逐项出现、逐项打勾;每项与"扫描光"扫过对应硬件图标的
 * 动画同步。时间轴按真实开机节奏:CPU 检测快、内存测试慢(计数)、
 * 存储设备中等、显示初始化快——不是均匀间隔。
 * 完成后停留,随后自动循环重新自检。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.rom = {};

const MRO = LX.materials;

// 主板上的 BIOS 芯片(SOIC 封装,'rom' 入口)
LX.models.rom.chip = function () {
  const g = new THREE.Group();
  const body = LX.geo.rbox(0.14, 0.018, 0.09, MRO.mat(0x101318, { metalness: 0.3, roughness: 0.55 }), 0.004, 1);
  body.position.y = 0.009;
  const dot = LX.geo.cyl(0.008, 0.002, MRO.mat(0x8a8f98, { roughness: 0.5 }), 10);
  dot.position.set(-0.05, 0.019, 0.03);
  for (let i = 0; i < 4; i++) {
    const p1 = LX.geo.rbox(0.02, 0.004, 0.012, MRO.mat(0x8a8f98, { metalness: 0.8, roughness: 0.3 }), 0, 1);
    p1.position.set(-0.045 + i * 0.03, 0.004, -0.05);
    const p2 = p1.clone();
    p2.position.z = 0.05;
    g.add(p1, p2);
  }
  g.add(body, dot);
  return g;
};

/* ---------- POST 自检节点 ---------- */
const POST_ITEMS = [
  { icon: 'cpu', text: '检测 CPU', detail: 'LX CORE i9 · 8C/16T', dur: 0.5 },
  { icon: 'dram', text: '内存自检', counter: 65536, unit: ' KB', dur: 2.6 },
  { icon: 'gpu', text: '初始化显示', detail: '1920×1080', dur: 0.7 },
  { icon: 'disk', text: '检测存储设备', detail: 'NVMe SSD 1024GB', dur: 1.4 },
  { icon: 'net', text: '初始化网络栈', dur: 0.5 },
  { icon: 'usb', text: '枚举 USB 设备', detail: '2 devices', dur: 0.9 },
];

LX.models.rom.post = function () {
  const g = new THREE.Group();
  const W = 2.5, H = 1.5;

  // 终端面板(逐帧重绘的 CanvasTexture)
  const cv = document.createElement('canvas');
  cv.width = 768; cv.height = 460;
  const g2d = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false }));
  panel.position.set(0, 1.15, -0.35);
  panel.rotation.x = -0.08;
  g.add(panel);

  // BIOS 芯片本体(面板下方)
  const chipBoard = LX.geo.rbox(1.6, 0.05, 1.0, MRO.pcb(), 0.012, 2);
  chipBoard.position.set(0, 0.03, 0.35);
  g.add(chipBoard);
  const biosChip = LX.geo.rbox(0.2, 0.03, 0.13, MRO.mat(0x101318, { metalness: 0.3, roughness: 0.55 }), 0.006, 1);
  biosChip.position.set(0, 0.06, 0.35);
  g.add(biosChip);

  // 硬件图标块(扫描光扫过的对象):CPU/内存条/硬盘/显卡/网卡/USB
  const iconDefs = [
    { key: 'cpu', x: -0.95, w: 0.22, h: 0.16, mat: MRO.mat(0x3a3f47, { metalness: 0.5, roughness: 0.4 }) },
    { key: 'dram', x: -0.55, w: 0.4, h: 0.1, mat: MRO.mat(0x27405c, { metalness: 0.5, roughness: 0.4 }) },
    { key: 'gpu', x: -0.1, w: 0.28, h: 0.14, mat: MRO.mat(0x2e4a6e, { metalness: 0.5, roughness: 0.4 }) },
    { key: 'disk', x: 0.3, w: 0.34, h: 0.12, mat: MRO.mat(0x1f2b1a, { metalness: 0.3, roughness: 0.55 }) },
    { key: 'net', x: 0.66, w: 0.2, h: 0.1, mat: MRO.mat(0x20344a, { metalness: 0.5, roughness: 0.4 }) },
    { key: 'usb', x: 0.94, w: 0.16, h: 0.09, mat: MRO.mat(0x262b33, { metalness: 0.4, roughness: 0.5 }) },
  ];
  const icons = {};
  for (const ic of iconDefs) {
    const body = LX.geo.rbox(ic.w, ic.h, 0.5, ic.mat, 0.01, 1);
    body.position.set(ic.x, ic.h / 2 + 0.05, 0);
    // 扫描光(亮条,激活时来回扫)
    const scan = new THREE.Mesh(new THREE.BoxGeometry(ic.w + 0.02, ic.h + 0.02, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x7fe8a0, transparent: true, opacity: 0 }));
    scan.position.set(ic.x, ic.h / 2 + 0.05, 0);
    g.add(body, scan);
    icons[ic.key] = { body, scan, phase: 0 };
  }

  /* ----- POST 时间轴状态机 ----- */
  let itemIdx = 0;     // 当前项
  let itemT = 0;       // 当前项耗时
  let done = [];       // 已完成项(文本)
  let holdT = 0;       // 完成后停留
  let frameDirty = true;

  function drawTerminal() {
    const g = g2d;
    g.fillStyle = '#060a08';
    g.fillRect(0, 0, 768, 460);
    // 边框
    g.strokeStyle = 'rgba(90,220,140,0.35)';
    g.lineWidth = 3;
    g.strokeRect(8, 8, 752, 444);
    g.font = 'bold 22px monospace';
    g.fillStyle = 'rgba(120,230,160,0.9)';
    g.fillText('LX BIOS v2.1 — Power-On Self Test', 28, 46);
    g.font = '20px monospace';
    let y = 92;
    // 已完成项
    for (const line of done) {
      g.fillStyle = '#a8ffd0';
      g.fillText(line.text, 30, y);
      g.fillStyle = '#51e88c';
      g.fillText('✓', 560, y);
      g.fillStyle = 'rgba(160,200,180,0.55)';
      g.fillText(line.note, 600, y);
      y += 34;
    }
    // 当前项(带进行中的动画字符)
    if (itemIdx < POST_ITEMS.length) {
      const it = POST_ITEMS[itemIdx];
      const k = Math.min(itemT / it.dur, 1);
      const spin = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[Math.floor(itemT * 12) % 10];
      g.fillStyle = '#e6ffe0';
      g.fillText(`${it.text} …`, 30, y);
      g.fillStyle = '#ffd75e';
      g.fillText(spin, 320, y);
      if (it.counter) {
        const kb = Math.floor(k * it.counter);
        g.fillText(`${kb} KB`, 360, y);
        // 内存测试进度条
        g.strokeStyle = 'rgba(120,230,160,0.6)';
        g.strokeRect(470, y - 16, 200, 20);
        g.fillStyle = '#51e88c';
        g.fillRect(472, y - 14, 196 * k, 16);
      } else if (it.detail) {
        g.fillStyle = 'rgba(200,230,210,0.7)';
        g.fillText(it.detail, 360, y);
      }
      y += 34;
    } else if (holdT === 0) {
      g.fillStyle = '#51e88c';
      g.fillText('POST 完成,启动引导…', 30, y);
    }
    // 光标闪烁
    if (Math.floor(performance.now() / 400) % 2 === 0) {
      g.fillStyle = '#7fe8a0';
      g.fillRect(30, y - 16, 12, 20);
    }
    tex.needsUpdate = true;
  }

  g.userData.tick = (dt) => {
    if (itemIdx < POST_ITEMS.length) {
      const it = POST_ITEMS[itemIdx];
      itemT += dt;
      // 扫描光:激活项的图标上来回扫
      const ic = icons[it.icon];
      if (ic) {
        ic.phase += dt * 3.2;
        const sweep = Math.sin(ic.phase) * 0.5 + 0.5; // 0..1
        ic.scan.material.opacity = 0.55;
        ic.scan.position.z = -0.25 + sweep * 0.5;
      }
      if (itemT >= it.dur) {
        const note = it.detail || (it.counter ? it.counter + ' KB' : '');
        done.push({ text: it.text, note });
        const ic2 = icons[it.icon];
        if (ic2) ic2.scan.material.opacity = 0;
        itemIdx++;
        itemT = 0;
      }
      frameDirty = true;
    } else {
      holdT += dt;
      if (holdT > 2.5) { // 停留后重新自检
        itemIdx = 0; itemT = 0; done = []; holdT = 0;
      }
    }
    if (frameDirty) { drawTerminal(); frameDirty = false; }
  };
  return g;
};
