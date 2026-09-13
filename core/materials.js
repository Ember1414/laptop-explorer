/* ============================================================
 * core/materials.js — PBR 材质预设库 + 程序化纹理
 * 统一标准参数(QUALITY_BASELINE 一):金属/塑料/玻璃/橡胶等,
 * 所有部件从这里取材质,禁止各文件自造参数。
 * ============================================================ */
window.LX = window.LX || {};
LX.materials = {};
LX.textures = {};

const _mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3, ...opts });

/* ---------- 程序化微表面纹理(单例,多模型共享) ---------- */

// 方向性拉丝(金属):roughnessMap + bumpMap 用
let _brushed = null;
LX.textures.brushed = function () {
  if (_brushed) return _brushed;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6a6a6a';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    // 每行一条方向性拉丝,亮度随机抖动
    const v = 108 + Math.random() * 58;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, y, 256, 1);
    if (Math.random() < 0.3) { // 偶发的划痕亮线
      const x = Math.random() * 256;
      g.fillStyle = 'rgba(210,210,210,0.5)';
      g.fillRect(x, y, 30 + Math.random() * 90, 1);
    }
  }
  _brushed = new THREE.CanvasTexture(c);
  _brushed.wrapS = _brushed.wrapT = THREE.RepeatWrapping;
  _brushed.repeat.set(6, 2);
  return _brushed;
};

// 磨砂颗粒(塑料/橡胶):roughnessMap 用
let _grain = null;
LX.textures.grain = function () {
  if (_grain) return _grain;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 190 + Math.random() * 50;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _grain = new THREE.CanvasTexture(c);
  _grain.wrapS = _grain.wrapT = THREE.RepeatWrapping;
  return _grain;
};

// PCB 颜色贴图:多层色调的阻焊层 + 顶/内层铜走线 + 焊盘 + 丝印
// 密度要求(QUALITY_BASELINE 〇.5):近距离看不出"是贴图"
let _pcb = null;
LX.textures.pcbColor = function () {
  if (_pcb) return _pcb;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = mulberry32(3);

  // 分区阻焊层:不同区域深浅微差(模拟不同叠层/批次)
  g.fillStyle = '#1c4230';
  g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(28,74,50,0.75)';
  g.fillRect(0, 0, S * 0.62, S);
  g.fillStyle = 'rgba(24,64,44,0.8)';
  g.fillRect(S * 0.62, 0, S * 0.38, S * 0.4);
  g.fillStyle = 'rgba(34,86,58,0.55)';
  g.fillRect(S * 0.55, S * 0.5, S * 0.45, S * 0.5);

  // 内层铜走线(暗铜色,宽而淡,透过阻焊隐约可见)
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(146,100,52,${0.16 + rnd() * 0.14})`;
    g.lineWidth = 3 + rnd() * 5;
    let x = rnd() * S, y = rnd() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (rnd() < 0.5) x += (rnd() - 0.5) * 300; else y += (rnd() - 0.5) * 300;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // 顶层铜走线(亮铜色,细密,主干+分支)
  for (let i = 0; i < 130; i++) {
    const bright = rnd() < 0.25;
    g.strokeStyle = bright ? `rgba(222,168,96,${0.75 + rnd() * 0.2})` : `rgba(184,132,68,${0.45 + rnd() * 0.25})`;
    g.lineWidth = bright ? 2.5 + rnd() * 2 : 1.2 + rnd() * 2;
    let x = rnd() * S, y = rnd() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (rnd() < 0.5) x += (rnd() - 0.5) * 260; else y += (rnd() - 0.5) * 260;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // 地层敷铜网格(细十字网格,极淡)
  g.strokeStyle = 'rgba(120,150,120,0.10)';
  g.lineWidth = 1;
  for (let i = 0; i < S; i += 26) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }

  // 过孔(小圆点:暗环+亮心)
  for (let i = 0; i < 240; i++) {
    const x = rnd() * S, y = rnd() * S, r = 1.5 + rnd() * 2;
    g.fillStyle = 'rgba(90,90,96,0.9)';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(210,160,90,0.9)';
    g.beginPath(); g.arc(x, y, r * 0.45, 0, 7); g.fill();
  }

  // 金手指焊盘(成排小金块,常见于芯片/连接器旁)
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, y = rnd() * S, n = 4 + Math.floor(rnd() * 8);
    const vert = rnd() < 0.5;
    g.fillStyle = 'rgba(222,180,96,0.9)';
    for (let k = 0; k < n; k++) {
      if (vert) g.fillRect(x + k * 7, y, 4.5, 9 + rnd() * 6);
      else g.fillRect(x, y + k * 7, 9 + rnd() * 6, 4.5);
    }
  }

  // 丝印:白色位号框线 + 文字
  g.fillStyle = 'rgba(232,238,244,0.85)';
  g.strokeStyle = 'rgba(232,238,244,0.7)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 34; i++) {
    const x = rnd() * S, y = rnd() * S;
    g.strokeRect(x, y, 16 + rnd() * 34, 8 + rnd() * 12);
  }
  g.font = '13px monospace';
  for (let i = 0; i < 40; i++) {
    g.fillText(['R', 'C', 'U', 'Q', 'L', 'D'][i % 6] + (1 + Math.floor(rnd() * 999)), rnd() * S * 0.96, rnd() * S * 0.97);
  }
  _pcb = new THREE.CanvasTexture(c);
  _pcb.encoding = THREE.sRGBEncoding;
  return _pcb;
};

// PCB 法线贴图:从高度图(走线/焊盘凸起)实时计算,让走线有浮凸立体感
let _pcbN = null;
LX.textures.pcbNormal = function () {
  if (_pcbN) return _pcbN;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = mulberry32(77);
  // 高度图:底面中灰;走线/焊盘凸起;过孔凹点
  g.fillStyle = '#808080';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 110; i++) {
    g.strokeStyle = `rgba(200,200,200,${0.5 + rnd() * 0.4})`;
    g.lineWidth = 1.5 + rnd() * 2.5;
    let x = rnd() * S, y = rnd() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (rnd() < 0.5) x += (rnd() - 0.5) * 260; else y += (rnd() - 0.5) * 260;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 130; i++) {
    g.fillStyle = `rgba(230,230,230,${0.6 + rnd() * 0.3})`;
    g.fillRect(rnd() * S, rnd() * S, 5 + rnd() * 8, 4 + rnd() * 4);
  }
  const img = g.getImageData(0, 0, S, S);
  const h = (x, y) => img.data[((y + S) % S * S + (x + S) % S) * 4] / 255;
  const out = g.createImageData(S, S);
  const strength = 2.2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (h(x - 1, y) - h(x + 1, y)) * strength;
      const dy = (h(x, y - 1) - h(x, y + 1)) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * S + x) * 4;
      out.data[i] = 128 + (dx / len) * 127;
      out.data[i + 1] = 128 + (dy / len) * 127;
      out.data[i + 2] = 128 + (1 / len) * 127;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  _pcbN = new THREE.CanvasTexture(c);
  return _pcbN;
};

// 屏幕桌面内容(自发光贴图,供 Bloom 拾取)
let _screen = null;
LX.textures.screen = function () {
  if (_screen) return _screen;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 320);
  grad.addColorStop(0, '#0c2038');
  grad.addColorStop(0.55, '#123a5c');
  grad.addColorStop(1, '#0a1420');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = 'rgba(180,215,255,0.85)';
  g.fillRect(60, 50, 190, 120);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(60, 50, 190, 22);
  g.fillStyle = 'rgba(150,190,235,0.8)';
  g.fillRect(280, 90, 170, 130);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(280, 90, 170, 20);
  g.fillStyle = 'rgba(10,20,30,0.85)';
  g.fillRect(0, 296, 512, 24);
  g.fillStyle = '#7fd4ff';
  for (let i = 0; i < 7; i++) g.fillRect(14 + i * 26, 302, 18, 12);
  _screen = new THREE.CanvasTexture(c);
  _screen.encoding = THREE.sRGBEncoding;
  return _screen;
};

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
LX.textures.random = mulberry32;

/* ---------- 材质预设 ---------- */
LX.materials = {
  mat: _mat,

  // 阳极氧化铝机身:方向性拉丝(roughnessMap + bump)
  alu: () => _mat(0xaab2bc, {
    metalness: 0.85, roughness: 0.85,
    roughnessMap: LX.textures.brushed(), bumpMap: LX.textures.brushed(), bumpScale: 0.0006,
  }),
  aluDark: () => _mat(0x767e88, {
    metalness: 0.8, roughness: 0.8,
    roughnessMap: LX.textures.brushed(), bumpMap: LX.textures.brushed(), bumpScale: 0.0005,
  }),
  // 金属转轴
  hinge: () => _mat(0x9aa2ad, { metalness: 0.9, roughness: 0.3 }),
  // 接口屏蔽壳
  port: () => _mat(0x101318, { metalness: 0.6, roughness: 0.35 }),
  // PCB(颜色贴图:多层铜/阻焊;法线贴图:走线浮凸)
  pcb: () => _mat(0xffffff, {
    map: LX.textures.pcbColor(), normalMap: LX.textures.pcbNormal(),
    normalScale: new THREE.Vector2(0.55, 0.55),
    metalness: 0.25, roughness: 0.62,
  }),
  // 芯片封装
  chip: () => _mat(0x14171c, { metalness: 0.5, roughness: 0.3 }),
  // 铜(热管/鳍片/引脚)
  copper: () => _mat(0xc98a3d, { metalness: 0.9, roughness: 0.25 }),
  // 电池软包铝塑膜
  pouch: () => _mat(0xb5bac2, { metalness: 0.35, roughness: 0.5 }),
  // 橡胶(脚垫/减震垫):高 roughness 无光泽
  rubber: () => _mat(0x141414, { metalness: 0, roughness: 1, roughnessMap: LX.textures.grain() }),
  // 深色塑料(键盘托盘/扬声器等):磨砂颗粒
  plasticDark: () => _mat(0x262b33, { metalness: 0.2, roughness: 0.8, roughnessMap: LX.textures.grain() }),
  // 机身内衬(吸光)
  dark: () => _mat(0x0a0c10, { metalness: 0, roughness: 1 }),

  // 屏幕玻璃:高光滑 + 自发光桌面内容(Bloom 拾取)
  screenGlass: () => new THREE.MeshPhysicalMaterial({
    color: 0x05070a, roughness: 0.12, metalness: 0.2,
    clearcoat: 0.5, clearcoatRoughness: 0.25,
    emissive: 0xffffff, emissiveMap: LX.textures.screen(), emissiveIntensity: 0.9,
  }),
  // 自发光 LED/指示灯
  led: (color = 0x33ff88, intensity = 2.6) => new THREE.MeshStandardMaterial({
    color: 0x0a2015, emissive: color, emissiveIntensity: intensity,
  }),
};
