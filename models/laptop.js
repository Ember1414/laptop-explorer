/* ============================================================
 * models/laptop.js — 整机外观(根节点)
 * 楔形机身(前薄后厚,ExtrudeGeometry 轮廓挤出)、真实开孔的侧墙
 * (接口/散热槽)、C 壳顶板(键帽井/触控板真实下沉)、屏幕总成、
 * 合页开合动画。几何建模遵守 QUALITY_BASELINE 〇 铁律。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.laptop = {};

// 键盘实际输入缓冲(打字 → 屏幕记事本,模块级:整机/键盘节点共用)
const TYPED = [];

/* ---------- 屏幕总成(盖):合盖姿态,铰链在原点,盖体沿 +z 平铺 ---------- */
LX.models.laptop.buildScreenLid = function () {
  const lid = new THREE.Group();
  const M = LX.materials;

  const shell = LX.geo.rbox(3.2, 0.07, 2.12, M.alu(), 0.022, 2);
  shell.position.set(0, 0, 1.06);

  const bezel = LX.geo.rbox(2.95, 0.05, 1.9, M.mat(0x1c2026, { roughness: 0.6, metalness: 0.3, roughnessMap: LX.textures.grain() }), 0.012, 2);
  bezel.position.set(0, -0.044, 1.06);
  const glass = LX.geo.rbox(2.65, 0.052, 1.6, M.screenGlass(), 0.008, 2);
  glass.position.set(0, -0.05, 1.06);

  // 屏幕:自发光"桌面"(壁纸 + 实时时钟 + 任务栏),开盖后半程点亮(开盖唤醒)
  const deskCv = document.createElement('canvas');
  deskCv.width = 1024; deskCv.height = 640;
  const dg = deskCv.getContext('2d');
  /* ----- EmberOS 桌面状态(屏幕可交互:图标/窗口/虚拟光标/虚拟键盘) ----- */
  const OS = {
    wallpaperImg: null,
    cursor: { x: 760, y: 320, show: false },
    wins: { notepad: true, pc: false, settings: false },
    focus: 'notepad',
    osk: false,
    hits: [],
  };
  lid.userData.os = OS;
  lid.userData.osMove = (cx, cy) => {
    const dx = cx - OS.cursor.x, dy = cy - OS.cursor.y;
    OS.cursor.x = cx; OS.cursor.y = cy; OS.cursor.show = true;
    if (dx * dx + dy * dy > 9) lid.userData.typedDirty = true;
  };
  lid.userData.osClick = (cx, cy) => {
    OS.cursor.x = cx; OS.cursor.y = cy; OS.cursor.show = true;
    for (const h of [...OS.hits].reverse()) {
      if (cx < h.x || cx > h.x + h.w || cy < h.y || cy > h.y + h.h) continue;
      if (h.t === 'icon' || h.t === 'task') { OS.wins[h.win] = true; OS.focus = h.win; }
      else if (h.t === 'close') { OS.wins[h.win] = false; }
      else if (h.t === 'wall') { const inp = document.getElementById('wall-input'); if (inp) inp.click(); }
      else if (h.t === 'osk-toggle') { OS.osk = !OS.osk; }
      else if (h.t === 'key') {
        if (h.ch === '⌫') TYPED.pop();
        else if (h.ch === '⏎') TYPED.push('\n');
        else if (h.ch === '␣') TYPED.push(' ');
        else TYPED.push(h.ch);
        if (TYPED.length > 150) TYPED.shift();
      }
      break;
    }
    lid.userData.typedDirty = true;
  };
  lid.userData.setWallpaper = (img) => { OS.wallpaperImg = img; lid.userData.typedDirty = true; };

  let lastClockKey = '';
  const drawDesk = () => {
    const now = new Date(); // 与真实系统时间一致
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    OS.hits = [];
    // 电脑模式横幅(sceneManager 进入/退出 PC 时通过 LX.osPC 开关)
    if (OS.pcHint) {
      dg.fillStyle = 'rgba(20,160,110,0.92)';
      dg.fillRect(0, 0, 1024, 34);
      dg.fillStyle = '#fff'; dg.font = 'bold 17px monospace'; dg.textAlign = 'center';
      dg.fillText('🖱 电脑模式已激活 · 移动鼠标/触控板 = 光标 · 点击 = 打开 · P 或 Esc 退出', 512, 24);
    }
    // 壁纸:用户图片(cover 铺满)或默认渐变
    if (OS.wallpaperImg && OS.wallpaperImg.naturalWidth) {
      const img = OS.wallpaperImg;
      const s = Math.max(1024 / img.naturalWidth, 640 / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      dg.drawImage(img, (1024 - w) / 2, (640 - h) / 2, w, h);
    } else {
      const grad = dg.createLinearGradient(0, 0, 1024, 640);
      grad.addColorStop(0, '#0b1e33'); grad.addColorStop(0.55, '#123a52'); grad.addColorStop(1, '#0a2b3a');
      dg.fillStyle = grad; dg.fillRect(0, 0, 1024, 640);
      dg.fillStyle = 'rgba(120,200,255,0.10)';
      dg.beginPath(); dg.ellipse(300, 220, 260, 170, -0.5, 0, 7); dg.fill();
      dg.fillStyle = 'rgba(80,255,200,0.07)';
      dg.beginPath(); dg.ellipse(760, 420, 300, 200, 0.4, 0, 7); dg.fill();
    }
    // 桌面图标列(真实可点开)
    const icons = [['🖥', '此电脑', 'pc'], ['📝', '记事本', 'notepad'], ['⚙', '设置', 'settings'], ['🖼', '壁纸', 'wall']];
    dg.textAlign = 'center';
    icons.forEach(([em, name, win], i) => {
      const ix = 34, iy = 92 + i * 118;
      dg.fillStyle = 'rgba(10,16,24,0.5)';
      dg.fillRect(ix, iy, 96, 98);
      dg.strokeStyle = 'rgba(140,190,235,0.25)';
      dg.strokeRect(ix, iy, 96, 98);
      dg.font = '40px "Segoe UI Emoji", monospace';
      dg.fillStyle = '#e8f2fb';
      dg.fillText(em, ix + 48, iy + 52);
      dg.font = '15px "Microsoft YaHei", monospace';
      dg.fillText(name, ix + 48, iy + 84);
      OS.hits.push({ t: win === 'wall' ? 'wall' : 'icon', win, x: ix, y: iy, w: 96, h: 98 });
    });
    // 桌面时钟
    dg.fillStyle = 'rgba(230,242,250,0.92)';
    dg.font = 'bold 54px "Segoe UI", monospace';
    dg.fillText(`${hh}:${mm}`, 380, 200);
    dg.font = '24px "Segoe UI", monospace';
    dg.fillStyle = 'rgba(200,225,240,0.75)';
    dg.fillText(dateStr, 380, 240);
    // 窗口
    const drawWindow = (x, y, w, h, title, win) => {
      dg.fillStyle = 'rgba(18,24,32,0.94)'; dg.fillRect(x, y, w, h);
      dg.strokeStyle = 'rgba(120,180,230,0.5)'; dg.lineWidth = 2; dg.strokeRect(x, y, w, h);
      dg.fillStyle = '#2b3340'; dg.fillRect(x, y, w, 30);
      dg.fillStyle = '#cfe0ee'; dg.font = 'bold 15px monospace'; dg.textAlign = 'left';
      dg.fillText(title, x + 10, y + 21);
      OS.hits.push({ t: 'task', win, x, y, w: w - 30, h: 30 });
      dg.fillStyle = '#a03030'; dg.fillRect(x + w - 26, y + 6, 20, 18);
      dg.fillStyle = '#fff'; dg.font = '13px monospace'; dg.fillText('✕', x + w - 21, y + 20);
      OS.hits.push({ t: 'close', win, x: x + w - 26, y: y + 6, w: 20, h: 18 });
    };
    if (OS.wins.notepad) {
      drawWindow(490, 66, 490, 330, '记事本 — 键盘实时输入', 'notepad');
      dg.font = '19px monospace'; dg.fillStyle = '#dce8f2';
      const lines = [];
      TYPED.join('').split('\n').forEach((seg) => {
        for (let i = 0; i < seg.length; i += 26) lines.push(seg.slice(i, i + 26));
      });
      lines.slice(-9).forEach((ln, i) => dg.fillText(ln, 506, 134 + i * 27));
      if (OS.focus === 'notepad' && Math.floor(Date.now() / 500) % 2) {
        const lastLine = lines.length ? lines[lines.length - 1] : '';
        dg.fillStyle = '#8fd4ff';
        dg.fillRect(506 + Math.min(lastLine.length % 26, 25) * 11, 134 + Math.min(lines.length - 1, 8) * 27 - 16, 10, 20);
      }
    }
    if (OS.wins.pc) {
      drawWindow(80, 360, 390, 220, '此电脑', 'pc');
      dg.font = '15px monospace'; dg.fillStyle = '#cfe0ee'; dg.textAlign = 'left';
      ['设备:Ember 14 · 屏 14" 2240×1400', 'CPU:LX Core i9 · 3.9GHz', '内存:16GB LPDDR5(板载焊接)', 'SSD:512GB NVMe(M2_1 · 2280)', '系统:EmberOS 13'].forEach((ln, i) => dg.fillText(ln, 94, 416 + i * 27));
    }
    if (OS.wins.settings) {
      drawWindow(490, 410, 460, 150, '设置', 'settings');
      dg.font = '15px monospace'; dg.fillStyle = '#cfe0ee'; dg.textAlign = 'left';
      dg.fillText('壁纸:选择本地图片设为桌面', 506, 446);
      dg.fillStyle = '#2f6f9f'; dg.fillRect(506, 458, 150, 32);
      dg.fillStyle = '#fff'; dg.fillText('🖼 更换壁纸', 524, 480);
      OS.hits.push({ t: 'wall', x: 506, y: 458, w: 150, h: 32 });
      dg.fillStyle = '#cfe0ee'; dg.font = '13px monospace';
      dg.fillText('输入:真实键盘 / 屏幕虚拟键盘', 506, 520);
      dg.fillText('交互:移动鼠标 = 光标,点击 = 打开', 506, 542);
    }
    // 快速输入条:记事本未打开时,键盘输入也随时可见(字不会"消失")
    if (!OS.wins.notepad && TYPED.length) {
      const txt = TYPED.join('').replace(/\n/g, ' ⏎ ').slice(-34);
      dg.fillStyle = 'rgba(14,20,28,0.88)';
      dg.fillRect(60, 524, 640, 48);
      dg.strokeStyle = 'rgba(120,180,230,0.5)'; dg.lineWidth = 2; dg.strokeRect(60, 524, 640, 48);
      dg.fillStyle = '#dce8f2'; dg.font = '20px monospace'; dg.textAlign = 'left';
      dg.fillText(txt, 76, 555);
    }
    // 任务栏
    dg.fillStyle = 'rgba(8,14,20,0.85)'; dg.fillRect(0, 592, 1024, 48);
    dg.fillStyle = '#4cc2ff';
    dg.beginPath(); dg.arc(30, 616, 12, 0, 7); dg.fill();
    dg.fillStyle = 'rgba(255,255,255,0.85)'; dg.font = '16px monospace'; dg.textAlign = 'left';
    dg.fillText(OS.osk ? '⌨ 隐藏键盘' : '⌨ 虚拟键盘', 56, 622);
    OS.hits.push({ t: 'osk-toggle', x: 50, y: 600, w: 150, h: 34 });
    dg.fillStyle = 'rgba(230,242,250,0.85)';
    dg.fillText(`Ember · ${hh}:${mm}`, 1004, 622);
    // 虚拟键盘(手机/触屏友好)
    if (OS.osk) {
      OS.oskKeys = [];
      const rows = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
      rows.forEach((row, r) => {
        row.split('').forEach((ch, i) => {
          const kx = 300 + i * 40 + r * 20, ky = 396 + r * 46;
          dg.fillStyle = 'rgba(30,38,50,0.92)'; dg.fillRect(kx, ky, 36, 40);
          dg.strokeStyle = 'rgba(120,180,230,0.4)'; dg.strokeRect(kx, ky, 36, 40);
          dg.fillStyle = '#dce8f2'; dg.font = '16px monospace'; dg.textAlign = 'center';
          dg.fillText(ch.toUpperCase(), kx + 18, ky + 26);
          OS.hits.push({ t: 'key', ch, x: kx, y: ky, w: 36, h: 40 });
        });
      });
      [['⌫', 740, 396], ['␣', 470, 534], ['⏎', 740, 534]].forEach(([ch, kx, ky]) => {
        dg.fillStyle = 'rgba(30,38,50,0.92)'; dg.fillRect(kx, ky, ch === '␣' ? 200 : 64, 40);
        dg.strokeStyle = 'rgba(120,180,230,0.4)'; dg.strokeRect(kx, ky, ch === '␣' ? 200 : 64, 40);
        dg.fillStyle = '#dce8f2'; dg.font = '16px monospace'; dg.textAlign = 'center';
        dg.fillText(ch, kx + (ch === '␣' ? 100 : 32), ky + 26);
        OS.hits.push({ t: 'key', ch, x: kx, y: ky, w: ch === '␣' ? 200 : 64, h: 40 });
      });
    }
    // 虚拟光标
    if (OS.cursor.show) {
      const { x, y } = OS.cursor;
      dg.fillStyle = '#fff';
      dg.beginPath(); dg.moveTo(x, y); dg.lineTo(x + 14, y + 10); dg.lineTo(x + 5, y + 13); dg.closePath(); dg.fill();
      dg.strokeStyle = '#1a1e24'; dg.lineWidth = 1.5; dg.stroke();
    }
    lastClockKey = hh + ':' + mm;
  };
  drawDesk();
  const deskTex = new THREE.CanvasTexture(deskCv);
  deskTex.encoding = THREE.sRGBEncoding;
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f14, roughness: 0.18, metalness: 0,
    emissive: 0xffffff, emissiveMap: deskTex, emissiveIntensity: 0.05,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.48, 1.5), screenMat);
  screen.rotation.x = Math.PI / 2; // 法线朝 -y:合盖时藏于机身内,开盖朝向用户
  screen.position.set(0, -0.077, 1.06);
  const screenGrp = new THREE.Group();
  screenGrp.name = 'screen'; // 屏幕 = 显示原理子节点入口(点屏幕看 LCD/OLED/扫描)
  screenGrp.add(screen); // 关键修复:screen 必须挂进 screenGrp —— 此前组是孤儿,
                         // 电脑模式射线永远打不中屏幕(点击全部无反应)

  // B 面下边框(LX BOOK)蚀刻标识
  const chinCv = document.createElement('canvas');
  chinCv.width = 256; chinCv.height = 48;
  const chg = chinCv.getContext('2d');
  chg.font = '600 26px "Segoe UI", monospace';
  chg.textAlign = 'center';
  chg.fillStyle = 'rgba(200,208,216,0.8)';
  chg.fillText('E m b e r', 128, 34);
  const chinTex = new THREE.CanvasTexture(chinCv);
  chinTex.encoding = THREE.sRGBEncoding;
  const chin = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.064),
    new THREE.MeshStandardMaterial({ map: chinTex, transparent: true, alphaTest: 0.1, roughness: 0.45, metalness: 0.5 }));
  chin.rotation.x = Math.PI / 2;
  chin.position.set(0, -0.0695, 1.935);

  // 摄像头模组入口(边框顶部的小镜头 +'camera' 子节点入口;隐形命中盒扩大点击区)
  const camModule = new THREE.Group();
  camModule.name = 'camera';
  camModule.position.set(0, -0.042, 1.92);
  const camDot = LX.geo.cyl(0.016, 0.02, M.mat(0x10141c, { roughness: 0.2 }));
  camDot.rotation.x = Math.PI / 2;
  const camRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.004, 8, 20),
    M.mat(0x2a2f38, { metalness: 0.6, roughness: 0.4 }));
  const camLedMat = M.led(0xffffff, 0.0); // 摄像头工作指示灯(开盖唤醒后亮)
  const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), camLedMat);
  camLed.position.set(0.05, 0.004, 0);
  const camHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.16, 0.08),
    new THREE.MeshBasicMaterial({ visible: false }));
  camModule.add(camDot, camRing, camLed, camHit);

  const barrels = LX.models.hinge.buildBarrels();
  barrels.name = 'hinge'; // 转轴子节点入口
  barrels.position.set(0, -0.015, 0.02);

  // A 面 Logo(金属圆牌)
  const logo = LX.geo.cyl(0.09, 0.004, M.mat(0xd7dde4, { metalness: 0.95, roughness: 0.2 }), 32);
  logo.position.set(0, 0.037, 1.06);
  const aCv = document.createElement('canvas');
  aCv.width = 256; aCv.height = 48;
  const ag = aCv.getContext('2d');
  ag.font = '600 30px "Segoe UI", monospace';
  ag.textAlign = 'center';
  ag.fillStyle = 'rgba(190,198,208,0.9)';
  ag.fillText('E m b e r', 128, 34);
  const aTex = new THREE.CanvasTexture(aCv);
  aTex.encoding = THREE.sRGBEncoding;
  const aMark = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.086),
    new THREE.MeshStandardMaterial({ map: aTex, transparent: true, alphaTest: 0.1, roughness: 0.4, metalness: 0.6 }));
  aMark.rotation.x = -Math.PI / 2;
  aMark.position.set(-0.42, 0.0392, 1.06);
  screenGrp.add(screen, chin);
  lid.add(shell, bezel, glass, screenGrp, camModule, barrels, logo, aMark);
  lid.userData.screenMat = screenMat;
  lid.userData.camLedMat = camLedMat;
  lid.userData.updateClock = () => {
    const now = new Date();
    const key = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    if (!lid.userData.typedDirty && key === lastClockKey) return;
    lid.userData.typedDirty = false;
    drawDesk();
    deskTex.needsUpdate = true;
  };
  // OS 交互 API 暴露给场景管理器(电脑模式的光标/点击/横幅)
  LX.osMove = lid.userData.osMove;
  LX.osClick = lid.userData.osClick;
  LX.osPC = (on) => { OS.pcHint = !!on; lid.userData.typedDirty = true; };
  // 壁纸:file:// 打开页面时尝试直接读取用户桌面图片;失败则用 设置→更换壁纸 选择
  try {
    const tryWall = new Image();
    tryWall.onload = () => { OS.wallpaperImg = tryWall; lid.userData.typedDirty = true; };
    tryWall.src = encodeURI('file:///C:/Users/TD/Desktop/【哲风壁纸】可爱-宠物-家养.jpg');
  } catch (e) { /* http 环境浏览器会拦截 file://,走设置窗口的文件选择即可 */ }
  const wallInput = document.getElementById('wall-input');
  if (wallInput && !wallInput.dataset.wired) {
    wallInput.dataset.wired = '1';
    wallInput.addEventListener('change', () => {
      const f = wallInput.files && wallInput.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => { OS.wallpaperImg = img; lid.userData.typedDirty = true; };
      img.src = URL.createObjectURL(f);
    });
  }
  return lid;
};

/* ---------- 侧墙轮廓(u=z, v=y),holes:接口开孔 ---------- */
function sideWallShape(holes) {
  const s = new THREE.Shape();
  s.moveTo(-1.075, 0.012);
  s.lineTo(1.075, 0.012);
  s.lineTo(1.075, 0.0875);
  s.quadraticCurveTo(1.075, 0.1075, 1.04, 0.109);
  s.lineTo(-1.04, 0.156);
  s.quadraticCurveTo(-1.075, 0.1575, -1.075, 0.1275);
  s.closePath();
  s.holes = holes;
  return s;
}

/** 侧墙(带真实接口开孔)。side:-1 左墙 / +1 右墙 */
LX.models.laptop.buildSideWall = function (side) {
  const holes = [];
  if (side < 0) {
    holes.push(LX.geo.rectHole(-0.82, 0.06, 0.26, 0.05)); // HDMI
    holes.push(LX.geo.rectHole(-0.44, 0.06, 0.14, 0.05)); // USB-A
    holes.push(LX.geo.rectHole(-0.12, 0.06, 0.14, 0.05)); // USB-A
  } else {
    holes.push(LX.geo.rectHole(-0.76, 0.06, 0.12, 0.05)); // USB-C
    holes.push(LX.geo.rectHole(-0.46, 0.06, 0.12, 0.05)); // USB-C
    holes.push(LX.geo.circleHole(-0.05, 0.06, 0.03));     // 3.5mm
  }
  const geo = LX.geo.extrudeWithHoles(sideWallShape(holes), { depth: 0.05 });
  geo.rotateY(-Math.PI / 2); // 挤出方向 → 世界 -x,轮廓 u → 世界 z
  const mesh = new THREE.Mesh(geo, LX.materials.alu());
  mesh.position.x = side < 0 ? -1.55 : 1.6;
  return mesh;
};

/** 后墙:13 条真实散热通槽(离心风扇排风方向) */
LX.models.laptop.buildRearWall = function (withVents = true) {
  const s = new THREE.Shape();
  s.moveTo(-1.075, 0.012);
  s.lineTo(1.075, 0.012);
  s.lineTo(1.075, 0.13);
  s.quadraticCurveTo(1.075, 0.15, 1.055, 0.15);
  s.lineTo(-1.055, 0.15);
  s.quadraticCurveTo(-1.075, 0.15, -1.075, 0.13);
  s.closePath();
  if (withVents) for (let i = 0; i < 13; i++) s.holes.push(LX.geo.rectHole(-0.9 + i * 0.15, 0.07, 0.09, 0.036));
  const geo = LX.geo.extrudeWithHoles(s, { depth: 0.05 });
  const mesh = new THREE.Mesh(geo, LX.materials.alu());
  mesh.position.z = -1.1;
  return mesh;
};

/** 前墙(无开孔) */
LX.models.laptop.buildFrontWall = function () {
  const s = new THREE.Shape();
  s.moveTo(-1.075, 0.012);
  s.lineTo(1.075, 0.012);
  s.lineTo(1.075, 0.0875);
  s.quadraticCurveTo(1.075, 0.1075, 1.055, 0.1075);
  s.lineTo(-1.055, 0.1075);
  s.quadraticCurveTo(-1.075, 0.1075, -1.075, 0.0875);
  s.closePath();
  const geo = LX.geo.extrudeWithHoles(s, { depth: 0.05 });
  const mesh = new THREE.Mesh(geo, LX.materials.alu());
  mesh.position.z = 1.05;
  return mesh;
};

/** C 壳顶板:水平薄板,键帽井与触控板为面上真实开孔(有井壁、有深度) */
LX.models.laptop.buildDeckPlate = function (withCutouts = true) {
  const s = new THREE.Shape();
  s.moveTo(-1.55, -1.05);
  s.lineTo(1.55, -1.05);
  s.lineTo(1.55, 1.05);
  s.lineTo(-1.55, 1.05);
  s.closePath();
  if (withCutouts) {
    s.holes.push(LX.geo.rectHole(0, 0, 2.4, 0.9));      // 键帽井(z -0.45..0.45)
    s.holes.push(LX.geo.rectHole(0, 0.765, 1.05, 0.53)); // 触控板槽(z 0.5..1.03,与键帽井留缝)
  }
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.022, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1,
  });
  geo.rotateX(Math.PI / 2); // 轮廓 u→世界 x,v→世界 z,挤出→世界 -y
  const mesh = new THREE.Mesh(geo, LX.materials.alu());
  mesh.position.y = 0.127;
  return mesh;
};

/* ---------- 接口内芯:孔内可见的真连接器(非黑洞) ---------- */
function buildPortInternals() {
  const M = LX.materials;
  const g = new THREE.Group();
  const shellM = M.mat(0x3a4048, { metalness: 0.75, roughness: 0.35 });
  const tongueM = M.mat(0x14171c, { metalness: 0.3, roughness: 0.5 });
  const pinT = [];
  const mkPins = (x, z, n, gap) => {
    for (let i = 0; i < n; i++) pinT.push({ p: [x, 0.058, z - (n - 1) * gap / 2 + i * gap], r: [0, 0, 0] });
  };
  // 左墙:HDMI(z-0.82)+ USB-A ×2(z-0.44 / -0.12)
  const hdmi = LX.geo.rbox(0.07, 0.055, 0.25, shellM, 0.004, 1);
  hdmi.position.set(-1.565, 0.06, -0.82);
  const hdmiTongue = LX.geo.rbox(0.05, 0.014, 0.18, tongueM, 0, 1);
  hdmiTongue.position.set(-1.573, 0.06, -0.82);
  mkPins(-1.578, -0.82, 10, 0.014);
  g.add(hdmi, hdmiTongue);
  for (const z of [-0.44, -0.12]) {
    const sh = LX.geo.rbox(0.065, 0.05, 0.135, shellM, 0.004, 1);
    sh.position.set(-1.568, 0.06, z);
    const tg = LX.geo.rbox(0.045, 0.012, 0.1, tongueM, 0, 1);
    tg.position.set(-1.575, 0.057, z);
    mkPins(-1.58, z, 4, 0.02);
    g.add(sh, tg);
  }
  // 右墙:USB-C ×2(z-0.82 / -0.52)+ 3.5mm(z-0.05)
  for (const z of [-0.82, -0.52]) {
    const sh = LX.geo.rbox(0.06, 0.052, 0.12, shellM, 0.005, 1);
    sh.position.set(1.568, 0.06, z);
    const tg = LX.geo.rbox(0.04, 0.008, 0.085, tongueM, 0, 1);
    tg.position.set(1.573, 0.057, z);
    g.add(sh, tg);
  }
  const jack = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 18),
    M.mat(0x8a8f98, { metalness: 0.9, roughness: 0.3 }));
  jack.rotation.y = Math.PI / 2;
  jack.position.set(1.578, 0.06, -0.05);
  const jackIn = LX.geo.cyl(0.016, 0.03, M.dark(), 12);
  jackIn.rotation.z = Math.PI / 2;
  jackIn.position.set(1.578, 0.06, -0.05);
  g.add(jack, jackIn);
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.008, 0.004, 0.008),
    M.mat(0xc9a227, { metalness: 0.95, roughness: 0.25 }), pinT));
  return g;
}

/* ---------- 扬声器点阵开孔(键盘两侧的细密孔阵) ---------- */
function buildGrilleDots() {
  const M = LX.materials;
  const t = [];
  const rnd = LX.textures.random(90);
  for (const sx of [-1, 1])
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 16; j++) {
        t.push({
          p: [sx * (1.27 + i * 0.048) + (rnd() - 0.5) * 0.004, 0.128, -0.36 + j * 0.048 + (rnd() - 0.5) * 0.004],
          r: [0, 0, 0],
          s: 0.85 + rnd() * 0.3,
        });
      }
  return LX.instanced.build(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 8),
    M.mat(0x10141a, { roughness: 0.7, metalness: 0.2 }), t);
}

/* ---------- 掌托蚀刻品牌 ---------- */
function buildBrandPlate() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 48;
  const cg = cv.getContext('2d');
  cg.font = '600 26px "Segoe UI", monospace';
  cg.textAlign = 'center';
  cg.fillStyle = 'rgba(215,221,228,0.85)';
  cg.fillText('E m b e r   1 4', 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  const brand = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.082),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, roughness: 0.4, metalness: 0.6 }));
  brand.rotation.x = -Math.PI / 2;
  brand.position.set(1.1, 0.1312, 0.88);
  return brand;
}

/* ---------- 根节点整机模型 ---------- */
LX.models.laptop.build = function () {
  const g = new THREE.Group();
  const M = LX.materials;
  g.name = 'interior'; // 整机即"主机内部"的入口

  // 底板(比四周墙体略小 3mm → 可见的分型缝台阶)
  const bottom = LX.geo.rbox(3.17, 0.04, 2.17, M.aluDark(), 0.01, 2);
  bottom.position.y = 0.032;
  g.add(bottom);

  // 四周墙体:侧墙带真实接口开孔,后墙带真实散热通槽
  g.add(
    LX.models.laptop.buildSideWall(-1),
    LX.models.laptop.buildSideWall(1),
    LX.models.laptop.buildRearWall(true),
    LX.models.laptop.buildFrontWall()
  );

  // 吸光内衬(透过接口/散热孔看到机身内部,而非背景)
  const liner = LX.geo.rbox(2.9, 0.06, 1.8, M.dark(), 0, 1);
  liner.position.y = 0.065;
  g.add(liner);

  // C 壳顶板(键帽井/触控板真实下沉)
  g.add(LX.models.laptop.buildDeckPlate(true));

  // 键盘(真实 15u 布局:功能行/主键区/空格排,字符键帽)与触控板
  const kb = LX.models.keyboard.build();
  kb.group.name = 'keyboard'; // 键盘子节点入口
  kb.group.position.y = 0.043; // 键盘组装下沉入键帽井(托盘贴内衬,键帽微低于 C 壳面)
  g.add(kb.group);
  g.userData.keys = kb.keys; // 按压反馈契约:管理器驱动下沉动画
  const tpGrp = LX.models.touchpad.build({ demo: false }); // 装配视图:无手指演示件
  tpGrp.name = 'touchpad';    // 触控板子节点入口
  tpGrp.position.set(0, 0.071, 0.765); // 玻璃面与 C 壳面齐平(仅发丝级露边)
  g.add(tpGrp);

  // 橡胶脚垫
  for (const [fx, fz] of [[-1.42, -0.92], [1.42, -0.92], [-1.42, 0.92], [1.42, 0.92]]) {
    const foot = LX.geo.cyl(0.05, 0.016, M.rubber(), 16);
    foot.position.set(fx, 0.008, fz);
    g.add(foot);
  }

  // 拟真细节:接口内芯(孔内可见连接器)+ 扬声器点阵开孔 + 掌托蚀刻品牌
  g.add(buildPortInternals(), buildGrilleDots(), buildBrandPlate());

  // D 面进风开孔(后缘一排)+ 法规贴纸
  const ventT = [];
  for (let i = 0; i < 26; i++) ventT.push({ p: [-1.15 + i * 0.092, 0.009, -0.88], r: [0, 0, 0] });
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.045, 0.006, 0.016),
    M.mat(0x10141a, { roughness: 0.7 }), ventT));
  const regCv = document.createElement('canvas');
  regCv.width = 512; regCv.height = 128;
  const rg = regCv.getContext('2d');
  rg.fillStyle = '#d8dce2'; rg.fillRect(0, 0, 512, 128);
  rg.fillStyle = '#2b2f36';
  rg.font = 'bold 24px monospace';
  rg.fillText('Ember 14 · Model EM1401', 16, 36);
  rg.font = '18px monospace';
  rg.fillText('56Wh · Input 20V ⎓ 3.25A · Ember Inc.', 16, 68);
  rg.fillText('Made by Ember · CE UKCA FCC ID 2AX-EM14', 16, 98);
  const regTex = new THREE.CanvasTexture(regCv);
  regTex.encoding = THREE.sRGBEncoding;
  const regSticker = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15),
    new THREE.MeshStandardMaterial({ map: regTex, roughness: 0.65, metalness: 0.05 }));
  regSticker.rotation.x = Math.PI / 2; // 法线朝 -y:贴在底面
  regSticker.position.set(0.5, 0.0115, -0.5);
  g.add(regSticker);

  // 电源指示灯(嵌在右墙外面,自发光,Bloom 拾取)
  const led = LX.geo.cyl(0.012, 0.004, M.led(), 10);
  led.rotation.z = Math.PI / 2;
  led.position.set(1.6015, 0.06, 0.92);
  g.add(led);

  // 屏幕总成,通过转轴连接;入场从合盖打开到约 100°
  const lid = LX.models.laptop.buildScreenLid();
  lid.position.set(0, 0.155, -1.05);
  // 电源适配器(整机外配件,'charger' 子节点入口;完全在机身之外)
  const charger = LX.models.charger.build();
  charger.name = 'charger';
  charger.position.set(2.2, 0.02, 1.75);
  charger.rotation.y = -0.5;
  g.add(charger);

  // 外接线缆(弯管):AC 电源线伸向墙插方向;DC 输出线精确插入右墙 USB-C 充电口
  const cableMat = M.mat(0x14171c, { roughness: 0.55, metalness: 0.05 });
  const mkCable = (pts, r) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 10, false), cableMat);
  };
  g.add(mkCable([[1.68, 0.06, 1.98], [1.2, 0.03, 2.14], [0.1, 0.02, 2.24], [-0.9, 0.02, 2.3]], 0.016));
  // 线缆应力释放护套(出线口鼓包)
  for (const [sx, sz] of [[1.68, 1.98], [1.84, 1.6]]) {
    const relief = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), cableMat);
    relief.scale.set(1.6, 1, 1);
    relief.position.set(sx, 0.06, sz);
    g.add(relief);
  }
  const acPlug = LX.geo.rbox(0.12, 0.1, 0.16, M.mat(0x2b2f36, { roughness: 0.55 }), 0.012, 1);
  acPlug.position.set(-1.02, 0.05, 2.34);
  g.add(acPlug);
  g.add(mkCable([[1.84, 0.06, 1.6], [1.95, 0.045, 0.5], [1.78, 0.05, -0.25], [1.585, 0.06, -0.73]], 0.013));
  const dcTip = LX.geo.cyl(0.021, 0.07, M.mat(0x3a3f47, { metalness: 0.6, roughness: 0.4 }), 12);
  dcTip.rotation.z = Math.PI / 2;
  dcTip.position.set(1.585, 0.06, -0.78); // 对准右墙 USB-C(z -0.82)充电口
  g.add(dcTip);

  // 内部探索入口:底座光环 + 隐形命中环('interior' 入口,替代飘在半空的回退标记)
  // 悬停/点击机身任意位置即可进入内部 —— 与描述"点击机身掀开底盖"一致
  const intMark = new THREE.Group();
  intMark.name = 'interior';
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x4cc2ff, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.02, 8, 72), haloMat);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.012;
  const haloHit = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.0, 0.06, 48),
    new THREE.MeshBasicMaterial({ visible: false }));
  haloHit.position.y = 0.03;
  const intCv = document.createElement('canvas');
  intCv.width = 512; intCv.height = 64;
  const intg = intCv.getContext('2d');
  intg.font = 'bold 30px "Microsoft YaHei", monospace';
  intg.textAlign = 'center';
  intg.fillStyle = '#8fd4ff';
  intg.fillText('点击光环 · 掀开底盖看内部', 256, 42);
  const intSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(intCv), transparent: true, depthWrite: false, depthTest: false }));
  intSp.renderOrder = 10;
  intSp.scale.set(1.9, 0.24, 1);
  intSp.position.set(0, 0.34, 2.3);
  intMark.add(halo, haloHit, intSp);
  g.add(intMark);
  g.userData.haloMat = haloMat; // 入场动画中脉冲

  // 外接鼠标('mouse' 子节点入口:下钻看光学定位原理)
  const mouse = LX.models.mouse.build();
  mouse.name = 'mouse';
  mouse.position.set(-1.45, 0, 1.42);
  mouse.rotation.y = 0.4;
  g.add(mouse);

  // 键盘实际输入:打字/退格/回车 → 屏幕记事本;电源键开关屏幕
  let screenOn = true, typedDirty = false;
  LX.onKeyPress = (id) => {
    if (id === 'pwr') { screenOn = !screenOn; typedDirty = true; return; }
    let ch = null;
    if (/^[a-z]$/i.test(id)) ch = id.toUpperCase(); // i 标志:3D 键帽发大写 'Q' 也能输入(此前字母键全部被丢弃)
    else if (/^[0-9`\-=[\];',./\\]$/.test(id)) ch = id;
    else if (id === 'space') ch = ' ';
    else if (id === 'enter') ch = '\n';
    else if (id === 'back') { TYPED.pop(); lid.userData.typedDirty = true; return; }
    if (ch) {
      // 首次输入自动打开记事本并聚焦(像真 OS:打字去往焦点窗口)
      if (!OS.wins.notepad) { OS.wins.notepad = true; OS.focus = 'notepad'; }
      TYPED.push(ch);
      if (TYPED.length > 150) TYPED.shift();
      typedDirty = true;
    }
    if (typedDirty) lid.userData.typedDirty = true;
  };

  g.add(lid);

  g.userData.tick = (dt, t) => {
    lid.rotation.x = -1.745 * LX.Ease.outCubic(Math.min(Math.max((t - 0.35) / 1.7, 0), 1));
    // 开盖唤醒:盖子过半后屏幕点亮、摄像头指示灯亮起(拟真开机感)
    const s = LX.Ease.outCubic(Math.min(Math.max((t - 1.15) / 1.0, 0), 1));
    lid.userData.screenMat.emissiveIntensity = screenOn ? (0.05 + 1.45 * s) : 0.02;
    lid.userData.camLedMat.emissiveIntensity = screenOn ? 1.8 * s : 0.0;
    if (g.userData.haloMat) g.userData.haloMat.opacity = 0.26 + Math.sin(t * 2.2) * 0.14;
    if (lid.userData.updateClock) lid.userData.updateClock();
    typedDirty = false;
  };
  return g;
};
