/* ============================================================
 * models/io/keyboard.js — 键盘与单个按键
 * buildLayout(opts)  真实 15u 笔记本布局:功能行(0.6u)/主键区/空格排,
 *                    键帽宽度按真机排布(Tab 1.5u、Caps 1.75u、Shift
 *                    2.25/2.75u、Space 6.4u…),字符用一张共享图集贴出,
 *                    电源键带指示灯。
 * build()            整机 C 壳键帽井版本(按压契约:userData.keys + baseY)
 * buildKeyboardNode()键盘节点(同一布局放大;高亮放大键 = 下钻入口)
 * keySwitchNode()    单键下钻:剪式支架 + 橡胶穹顶形变 + 薄膜触点导通
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.keyboard = {};

/* ---------- 键帽文字内容(与 15u 排布一一对应) ---------- */
const LEGEND_TEXT = {
  esc: ['esc'],
  F1: ['F1'], F2: ['F2'], F3: ['F3'], F4: ['F4'], F5: ['F5'], F6: ['F6'],
  F7: ['F7'], F8: ['F8'], F9: ['F9'], F10: ['F10'], F11: ['F11'], F12: ['F12'],
  '`': ['`', '~'], '1': ['1', '!'], '2': ['2', '@'], '3': ['3', '#'], '4': ['4', '$'],
  '5': ['5', '%'], '6': ['6', '^'], '7': ['7', '&'], '8': ['8', '*'], '9': ['9', '('],
  '0': ['0', ')'], '-': ['-', '_'], '=': ['=', '+'],
  back: ['Backspace'], tab: ['Tab'],
  Q: ['Q'], W: ['W'], E: ['E'], R: ['R'], T: ['T'], Y: ['Y'], U: ['U'], I: ['I'], O: ['O'], P: ['P'],
  '[': ['[', '{'], ']': [']', '}'], '\\': ['\\', '|'],
  caps: ['Caps'], A: ['A'], S: ['S'], D: ['D'], F: ['F'], G: ['G'], H: ['H'], J: ['J'], K: ['K'], L: ['L'],
  ';': [';', ':'], "'": ["'", '"'], enter: ['Enter'],
  lshift: ['Shift'], Z: ['Z'], X: ['X'], C: ['C'], V: ['V'], B: ['B'], N: ['N'], M: ['M'],
  ',': [',', '<'], '.': ['.', '>'], '/': ['/', '?'], rshift: ['Shift'],
  lctrl: ['Ctrl'], fn: ['Fn'], win: ['Win'], lalt: ['Alt'],
  ralt: ['Alt'], rctrl: ['Ctrl'],
  pwr: [''],
};

/* ---------- 键帽字符纹理:每键一张【不透明】贴图(背景=键帽色,字符直接画上) ----------
 * 根治"字符消失":旧方案是透明图集 + alphaTest —— 细笔画在任何
 * mipmap/缩滤波/距离组合下都可能被 alpha 阈值整片丢弃。不透明贴图
 * 没有任何可丢弃的像素,字符恒定可见;MeshBasicMaterial 不受光照影响,
 * 暗面/背光/按压下沉时依然清晰。 */
function legendTexture(key, texCache) {
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = key === 'pwr' ? '#22262e' : '#2a303a';
  g.fillRect(0, 0, 128, 128);
  const info = LEGEND_TEXT[key];
  if (info && info[0]) {
    const [main, top] = info;
    g.fillStyle = 'rgba(216,226,235,0.95)';
    if (top) { // 双字符键:左上上档小字 + 左下主字(真机排布)
      g.textAlign = 'left';
      g.font = '600 30px "Segoe UI", monospace';
      g.fillText(top, 14, 42);
      g.font = '600 46px "Segoe UI", monospace';
      g.fillText(main, 14, 104);
    } else if (main.length === 1) {
      g.textAlign = 'left';
      g.font = '600 56px "Segoe UI", monospace';
      g.fillText(main, 20, 90);
    } else { // 词键(Tab/Caps/Shift/Enter…)
      g.textAlign = 'left';
      g.font = '600 27px "Segoe UI", "Microsoft YaHei", monospace';
      g.fillText(main, 12, 76);
    }
  }
  if (key === 'pwr') { // 电源符号(圆弧 + 竖线)
    g.strokeStyle = 'rgba(216,226,235,0.95)'; g.lineWidth = 8;
    g.beginPath(); g.arc(64, 72, 26, -Math.PI / 3, Math.PI + Math.PI / 3); g.stroke();
    g.beginPath(); g.moveTo(64, 36); g.lineTo(64, 70); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

/* ---------- 15u ANSI 排布(u = 键距,总宽 15u) ---------- */
const KB_ROWS = [
  { h: 0.6, keys: [['esc', 1], ['gap', 0.5], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], ['pwr', 1.5]] },
  { h: 1, keys: [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['back', 2]] },
  { h: 1, keys: [['tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5]] },
  { h: 1, keys: [['caps', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['enter', 2.25]] },
  { h: 1, keys: [['lshift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['rshift', 2.75]] },
  { h: 1, keys: [['lctrl', 1.35], ['fn', 1.15], ['win', 1.15], ['lalt', 1.15], ['space', 6.4], ['ralt', 1.15], ['rctrl', 2.65]] },
];

/* ---------- 布局构建(整机与键盘节点共用) ---------- */
LX.models.keyboard.buildLayout = function (opts = {}) {
  const u = opts.u || 0.159;
  const capH = opts.capH || 0.02;
  const M = LX.materials;
  const g = new THREE.Group();
  const W = 15 * u, D = 5.6 * u;

  // 托盘(整机版大于键帽井开孔,边缘藏进 C 壳下)
  const tray = LX.geo.rbox(W + 0.24, 0.06, D + 0.24,
    M.mat(0x22262c, { roughness: 0.8, metalness: 0.1, roughnessMap: LX.textures.grain() }), 0.008, 1);
  tray.position.y = 0.03;
  g.add(tray);
  const trayTop = 0.06;

  // 键盘背光(键帽下的导光膜,微光从缝隙透出)
  if (opts.backlight) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.97, D * 0.97),
      new THREE.MeshBasicMaterial({
        color: 0xbfe4ff, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = trayTop + 0.002;
    g.add(glow);
  }

  const keyMat = M.mat(0x2a303a, { roughness: 0.6, metalness: 0.08, roughnessMap: LX.textures.grain() });
  const pwrMat = M.mat(0x22262e, { roughness: 0.55, metalness: 0.1, roughnessMap: LX.textures.grain() });
  const geoCache = new Map();
  const texCache = new Map();      // 每次构建独立持有贴图:随组销毁,绝不跨构建共享
  const legendGeoCache = new Map();
  const legendMatCache = new Map();
  const keys = [];
  let zCursor = -D / 2;
  for (const row of KB_ROWS) {
    const rowH = row.h * u;
    let xCursor = -W / 2;
    for (const [key, wu] of row.keys) {
      const kw = wu * u;
      if (key !== 'gap') {
        const cw = kw - u * 0.09, cd = rowH - u * 0.09;
        const gk = cw.toFixed(4) + '|' + cd.toFixed(4);
        let capGeo = geoCache.get(gk);
        if (!capGeo) {
          capGeo = new THREE.RoundedBoxGeometry(cw, capH, cd, 2, Math.min(capH * 0.35, 0.01));
          geoCache.set(gk, capGeo);
        }
        const isPwr = key === 'pwr';
        const cap = new THREE.Mesh(capGeo, isPwr ? pwrMat : keyMat);
        const baseY = trayTop + capH / 2;
        cap.position.set(xCursor + kw / 2, baseY, zCursor + rowH / 2);
        cap.userData.baseY = baseY;
        cap.userData.keyId = key;
        if (key !== 'space' && LEGEND_TEXT[key]) {
          let lmat = legendMatCache.get(key);
          if (!lmat) {
            lmat = new THREE.MeshBasicMaterial({ map: legendTexture(key, texCache) }); // 不透明+per-build:字符永不消失
            lmat.userData.noTint = true; // 悬停高亮豁免:字符恒定不变
            legendMatCache.set(key, lmat);
          }
          let lg = legendGeoCache.get(key);
          if (!lg) { lg = new THREE.PlaneGeometry(cw * 0.84, cd * 0.84); legendGeoCache.set(key, lg); }
          const pl = new THREE.Mesh(lg, lmat);
          pl.rotation.x = -Math.PI / 2;
          pl.position.y = capH / 2 + 0.002;
          pl.renderOrder = 2; // 永远盖在键帽顶面
          cap.add(pl);
        }
        if (isPwr) { // 电源键指示灯
          const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), M.led(0x51e88c, 1.6));
          led.scale.y = 0.4;
          led.position.set(cw * 0.3, capH / 2 + 0.002, 0);
          cap.add(led);
        }
        keys.push(cap);
        g.add(cap);
      }
      xCursor += kw;
    }
    zCursor += rowH;
  }
  return { group: g, keys, u };
};

/* ---------- 整机 C 壳版本(键帽井内,带背光) ---------- */
LX.models.keyboard.build = function () {
  return LX.models.keyboard.buildLayout({ u: 0.159, capH: 0.02, backlight: true });
};

/* ---------- 键盘节点(放大布局 + 下钻入口) ---------- */
LX.models.keyboard.buildKeyboardNode = function () {
  const { group: g, keys } = LX.models.keyboard.buildLayout({ u: 0.2, capH: 0.055 });
  const M = LX.materials;
  g.userData.keys = keys; // 按压反馈契约

  // 下钻入口:悬浮的放大键(独立材质,避免悬停高亮染色整片键帽)
  const sw = new THREE.Mesh(
    new THREE.RoundedBoxGeometry(0.34, 0.07, 0.34, 2, 0.022),
    M.mat(0x3a424e, { roughness: 0.65, metalness: 0.1, roughnessMap: LX.textures.grain() }));
  sw.material.emissive = new THREE.Color(0x1a5f86);
  sw.material.emissiveIntensity = 0.55;
  sw.name = 'keyswitch';
  sw.position.set(1.42, 0.36, 0.82);
  sw.rotation.z = -0.12;
  const swPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.32, 8),
    M.mat(0x8f97a2, { metalness: 0.8, roughness: 0.3 }));
  swPole.position.set(1.42, 0.18, 0.82);
  g.add(sw, swPole);

  const lab = (() => {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const cg = cv.getContext('2d');
    cg.font = 'bold 30px "Microsoft YaHei", monospace';
    cg.textAlign = 'center';
    cg.fillStyle = '#8fd4ff';
    cg.fillText('键帽可按压 · 点击高亮键下钻', 256, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    sp.renderOrder = 10; // 永远置顶:任何角度/遮挡下提示文字都不消失
    sp.scale.set(2.0, 0.25, 1);
    sp.position.set(0, 0.55, 0.95);
    return sp;
  })();
  g.add(lab);
  return g;
};

/* ---------- 单个按键:剪式穹顶 + 薄膜电路 ---------- */
LX.models.keyboard.keySwitchNode = function () {
  const g = new THREE.Group();
  const M = LX.materials;
  const api = {};
  const state = { pressed: false, t: 0 }; // t:0 浮起 → 1 压实

  // 底座(薄膜电路载体)
  const base = LX.geo.rbox(1.3, 0.06, 1.3, M.mat(0x2a3038, { roughness: 0.75 }), 0.012, 2);
  base.position.y = 0.03;
  g.add(base);

  // 两层薄膜电路(半透明,触点圆环在中心;按下导通时触点高亮)
  const filmMat = (op) => new THREE.MeshPhysicalMaterial({
    color: 0xd8c26a, transparent: true, opacity: op, roughness: 0.35, clearcoat: 0.6,
  });
  const filmLower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.008, 0.9), filmMat(0.45));
  filmLower.position.y = 0.065;
  const filmUpper = filmLower.clone();
  filmUpper.position.y = 0.095;
  filmUpper.material = filmMat(0.45);
  g.add(filmLower, filmUpper);
  const filmMats = [filmLower.material, filmUpper.material]; // 导通时双层同步高亮

  // 触点(两个圆环,导通时同时点亮 + 电弧)
  const contactMat = new THREE.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.85, roughness: 0.3, emissive: 0x22ff88, emissiveIntensity: 0 });
  const c1 = LX.geo.cyl(0.07, 0.004, contactMat, 18); c1.position.set(0, 0.072, 0);
  const c2 = LX.geo.cyl(0.07, 0.004, contactMat, 18); c2.position.set(0, 0.089, 0);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x66ffb0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  spark.position.set(0, 0.08, 0);
  g.add(c1, c2, spark);

  // 剪式支架(剪刀脚:两组交叉连杆)
  const scissorMat = M.mat(0x565d68, { metalness: 0.7, roughness: 0.35 });
  const scissor = new THREE.Group();
  scissor.position.y = 0.13;
  const makeArm = (rot, sx) => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 0.62), scissorMat);
    a.rotation.x = rot;
    a.position.z = sx * 0.14;
    return a;
  };
  const arm1 = makeArm(0.5, 1), arm2 = makeArm(-0.5, 1);
  const arm3 = makeArm(-0.5, -1), arm4 = makeArm(0.5, -1);
  scissor.add(arm1, arm2, arm3, arm4);
  g.add(scissor);

  // 橡胶穹顶( silicone dome):半球壳,按压时翻边压扁的形变
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0xd8b86a, metalness: 0.05, roughness: 0.6,
    transparent: true, opacity: 0.85, side: THREE.DoubleSide,
  });
  const dome = new THREE.Group();
  const domeOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    domeMat);
  domeOuter.rotation.x = Math.PI; // 倒扣(穹顶朝下扣在薄膜上)
  const domeRim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 10, 26), domeMat);
  domeRim.rotation.x = Math.PI / 2;
  dome.add(domeOuter, domeRim);
  dome.position.y = 0.12; // 穹顶口沿贴上层膜
  g.add(dome);

  // 键帽
  const keycap = LX.geo.rbox(0.62, 0.08, 0.62, M.mat(0x3a424e, { roughness: 0.7, roughnessMap: LX.textures.grain() }), 0.028, 3);
  keycap.position.y = 0.34;
  g.add(keycap);

  const lab = (() => {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const cg = cv.getContext('2d');
    cg.font = 'bold 30px "Microsoft YaHei", monospace';
    cg.textAlign = 'center';
    cg.fillStyle = '#8fd4ff';
    cg.fillText('A', 128, 44);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(0.3, 0.15, 1);
    sp.position.set(0, 0.46, 0.32);
    return sp;
  })();
  g.add(lab);

  const domeBaseY = 0.12;
  api.press = function () { state.pressed = true; };
  api.release = function () { state.pressed = false; };

  g.userData.tick = (dt, t) => {
    // 穹顶状态:0 浮起(拱高) → 1 压实(塌陷)
    const target = state.pressed ? 1 : 0;
    // 弹性回弹:松开时用略快并带一点过冲的速度
    const k = state.pressed ? Math.min(dt * 9, 1) : Math.min(dt * 13, 1);
    const prev = state.t;
    state.t += (target - state.t) * k;
    if (!state.pressed && prev > 0.55 && state.t < 0.7) state.t = 0.62; // 轻微回弹停顿感
    const d = state.t;

    // 穹顶形变:高度压缩 + 外缘外扩 + 翻转感(中心下沉)
    dome.scale.set(1 + d * 0.14, 1 - d * 0.62, 1 + d * 0.14);
    dome.position.y = domeBaseY - d * 0.015;
    domeOuter.scale.y = 1 - d * 0.55; // 半球压扁

    // 键帽下沉
    keycap.position.y = 0.34 - d * 0.1;
    // 剪刀脚收拢
    arm1.rotation.x = 0.5 - d * 0.34;
    arm2.rotation.x = -0.5 + d * 0.34;
    arm3.rotation.x = -0.5 + d * 0.34;
    arm4.rotation.x = 0.5 - d * 0.34;
    scissor.position.y = 0.13 - d * 0.045;
    // 上层薄膜随穹顶下压而弯曲下沉,接近下层(压实的"行程终点"就是触点间隙闭合)
    filmUpper.position.y = 0.095 - d * 0.028;

    // 触点导通:压实瞬间高亮 + 电弧脉冲;两层薄膜同步泛绿(电流通路)
    const conducting = d > 0.82;
    contactMat.emissiveIntensity += ((conducting ? 1.6 : 0) - contactMat.emissiveIntensity) * Math.min(dt * 12, 1);
    const filmGlow = conducting ? 0.55 + Math.sin(t * 24) * 0.35 : 0;
    for (const fm of filmMats) {
      fm.emissive.setHex(0x22ff88);
      fm.emissiveIntensity += (filmGlow - fm.emissiveIntensity) * Math.min(dt * 12, 1);
    }
    spark.material.opacity = conducting ? (0.55 + Math.sin(t * 30) * 0.35) : 0;
    spark.scale.setScalar(conducting ? 0.8 + Math.sin(t * 18) * 0.25 : 0.001);
  };

  return g;
};
