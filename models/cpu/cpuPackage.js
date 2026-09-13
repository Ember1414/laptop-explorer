/* ============================================================
 * models/cpu/cpuPackage.js — CPU 封装
 * 金属 IHS 顶盖(高反光)+ 激光蚀刻文字、基板(墨绿 PCB + 金色触点环)、
 * LGA 触点阵列(InstancedMesh)、掀盖动画露出硅 die(晶体管网格程序化纹理)。
 * 掀盖动画契约:group.userData.tick(dt, t),t≈0.35s 后 IHS 升起悬停。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.cpu = {};

const MCP = LX.materials;

/* ---------- 硅 die 纹理:规则晶体管网格 + 功能分区 ---------- */
let _die = null;
LX.models.cpu.dieTexture = function () {
  if (_die) return _die;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = LX.textures.random(11);
  // 硅 base
  g.fillStyle = '#101319';
  g.fillRect(0, 0, S, S);
  // 功能分区(核心/缓存/IO,不同色 tint)
  const zones = [
    [40, 40, 260, 260, '#182a3c'],   // 核心 0
    [310, 40, 160, 260, '#1c2f4a'],  // 核心 1
    [40, 310, 430, 150, '#232040'],  // LLC 缓存
    [310, 40, 160, 100, '#1c3038'],  // GPU
  ];
  for (const [x, y, w, h, col] of zones) {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(200,220,255,0.25)';
    g.strokeRect(x, y, w, h);
  }
  // 规则晶体管微网格:密集平行线两方向叠加(规律、重复,与随机走线截然不同)
  for (const [x, y, w, h] of zones) {
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.strokeStyle = 'rgba(120,180,255,0.20)';
    g.lineWidth = 1;
    for (let i = x; i < x + w; i += 4) { g.beginPath(); g.moveTo(i, y); g.lineTo(i, y + h); g.stroke(); }
    g.strokeStyle = 'rgba(160,140,255,0.14)';
    for (let j = y; j < y + h; j += 4) { g.beginPath(); g.moveTo(x, j); g.lineTo(x + w, j); g.stroke(); }
    // 单元重复图案:每 24px 一个小单元块
    for (let i = x; i < x + w - 20; i += 24)
      for (let j = y; j < y + h - 20; j += 24) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(140,190,255,0.16)' : 'rgba(190,150,255,0.13)';
        g.fillRect(i + 3, j + 3, 18, 18);
      }
    g.restore();
  }
  // 分区间总线(细金线束)
  g.strokeStyle = 'rgba(222,180,96,0.8)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    g.moveTo(300 + rnd() * 4, 40 + rnd() * 300);
    g.lineTo(310, 310 + rnd() * 140);
    g.stroke();
  }
  _die = new THREE.CanvasTexture(c);
  _die.encoding = THREE.sRGBEncoding;
  return _die;
};

/* ---------- 封装模型(主板上的入口与独立节点共用) ---------- */
LX.models.cpu.package = function () {
  const g = new THREE.Group();
  const rnd = LX.textures.random(50);

  // 基板:墨绿 PCB
  const substrate = LX.geo.rbox(1.6, 0.05, 1.6, MCP.pcb(), 0.012, 2);
  substrate.position.y = 0.025;
  g.add(substrate);

  // LGA 金色触点环(基板上缘、IHS 外的一圈排点,InstancedMesh)
  const padT = [];
  const rows = [[0.66, 26], [0.72, 30]];
  for (const [rad, n] of rows)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rad > 0.7 ? 0.1 : 0);
      padT.push({
        p: [Math.cos(a) * rad, 0.052, Math.sin(a) * rad],
        r: [0, -a, 0], s: 0.9 + rnd() * 0.2,
      });
    }
  g.add(LX.instanced.build(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 8), MCP.mat(0xc9a227, { metalness: 0.95, roughness: 0.25 }), padT));

  // 硅 die(被 IHS 盖住,掀盖后可见)
  const die = LX.geo.rbox(0.85, 0.03, 0.85,
    MCP.mat(0xffffff, {
      map: LX.models.cpu.dieTexture(), metalness: 0.4, roughness: 0.28,
      emissive: 0x223044, emissiveIntensity: 0.35,
    }), 0.006, 1);
  die.position.y = 0.065;
  die.name = 'pipeline'; // 裸片 = 流水线子节点入口(不再用发光球占位)
  g.add(die);
  // die 周边小贴片电容(InstancedMesh)
  const capT = LX.instanced.jitterGrid({
    from: [-0.72, 0.056, -0.72], step: [0.36, 0, 0], cols: 5, rows: 1,
    jitterP: 0.008, jitterR: 0.1, scaleRange: [0.9, 1.1], seed: 12,
  });
  const capRow2 = LX.instanced.jitterGrid({
    from: [-0.72, 0.056, 0.72], step: [0.36, 0, 0], cols: 5, rows: 1,
    jitterP: 0.008, jitterR: 0.1, scaleRange: [0.9, 1.1], seed: 13,
  });
  const smd = MCP.mat(0x2b2f36, { metalness: 0.5, roughness: 0.4 });
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.07, 0.012, 0.04), smd, capT));
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.07, 0.012, 0.04), smd, capRow2));

  // IHS 金属顶盖:高反光 + 激光蚀刻文字
  const ihsGroup = new THREE.Group();
  const ihsTexC = document.createElement('canvas');
  ihsTexC.width = 256; ihsTexC.height = 256;
  const ig = ihsTexC.getContext('2d');
  ig.fillStyle = '#b9c1cb';
  ig.fillRect(0, 0, 256, 256);
  ig.fillStyle = '#8d959f';
  ig.font = 'bold 22px monospace';
  ig.fillText('LX CORE i9', 30, 60);
  ig.font = '14px monospace';
  ig.fillText('SRG19 3.90GHZ', 30, 90);
  ig.fillText('X210', 30, 114);
  // 蚀刻点阵
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++)
      if ((i * 8 + j) % 3 !== 0) ig.fillRect(150 + i * 8, 150 + j * 8, 5, 5);
  const ihsTex = new THREE.CanvasTexture(ihsTexC);
  ihsTex.encoding = THREE.sRGBEncoding;

  const ihs = LX.geo.rbox(1.1, 0.07, 1.1,
    MCP.mat(0xd7dde4, { metalness: 0.96, roughness: 0.16, map: ihsTex, roughnessMap: LX.textures.brushed() }),
    0.016, 3);
  ihs.position.y = 0.115;
  ihsGroup.add(ihs);
  // IHS 下的焊接阴影裙边
  const skirt = LX.geo.rbox(1.18, 0.015, 1.18, MCP.mat(0x8f97a2, { metalness: 0.85, roughness: 0.35 }), 0.008, 1);
  skirt.position.y = 0.078;
  ihsGroup.add(skirt);
  g.add(ihsGroup);

  // 掀盖动画:IHS 升起 + 倾斜悬停,t≈0.35s 起持续 1.6s
  g.userData.tick = (dt, t) => {
    const e = LX.Ease.outCubic(Math.min(Math.max((t - 0.35) / 1.6, 0), 1));
    ihsGroup.position.y = 0.75 * e;
    ihsGroup.position.z = 0.35 * e;
    ihsGroup.rotation.x = -0.42 * e;
    ihsGroup.rotation.z = 0.1 * e;
  };
  return g;
};

// 主板上的 CPU:同封装,但作为 'cpu' 入口组
LX.models.cpu.build = function () {
  const pkg = LX.models.cpu.package();
  const g = new THREE.Group();
  g.add(pkg);
  return g;
};
