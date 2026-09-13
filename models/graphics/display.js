/* ============================================================
 * models/graphics/display.js — 显示面板 + Framebuffer 扫描
 * 左侧:LCD 分层悬浮堆叠(自下而上)
 *   背光模组(LED 阵列)→ 下偏光片 → 液晶层(分子棒旋转)→
 *   彩色滤光片(RGB 子像素)→ 上偏光片
 * 右侧:OLED 对比(无背光,RGB 子像素自发光)
 * 前方:Framebuffer 逐行扫描面板——光带自上而下,扫过的行点亮为
 * 最终画面;速度可切 60Hz / 120Hz,直观对比刷新率。
 * 覆盖 UI:data-node="display"(60Hz / 120Hz / OLED 控光演示)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.display = {};

const MDI = LX.materials;

function dLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 360; c.height = 72;
  const g = c.getContext('2d');
  g.font = 'bold 34px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 180, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(1.15, 0.23, 1);
  return sp;
}

LX.models.display.build = function () {
  const g = new THREE.Group();
  const api = {};

  /* ================= LCD 分层堆叠(左,x=-1.55) ================= */
  const lcd = new THREE.Group();
  lcd.position.set(-1.55, 0, 0);

  // L1 背光模组:基板 + LED 阵列
  const backlight = new THREE.Group();
  const blBase = LX.geo.rbox(1.5, 0.08, 1.05, MDI.mat(0x3a3f47, { metalness: 0.4, roughness: 0.5 }), 0.01, 1);
  blBase.position.y = 0.05;
  backlight.add(blBase);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff6d8, emissiveIntensity: 1.6 });
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++) {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), ledMat);
      led.position.set(-0.6 + c * 0.3, 0.12, -0.3 + r * 0.3);
      backlight.add(led);
    }
  backlight.position.y = 0;
  const blLabel = dLabel('① 背光模组(LED 阵列)', '#ffe9b0');
  blLabel.position.set(0, 0.45, 0.55);
  backlight.add(blLabel);
  lcd.add(backlight);

  // L2 下偏光片
  const pol1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 1.05),
    new THREE.MeshPhysicalMaterial({ color: 0x9fc4e8, transparent: true, opacity: 0.32, roughness: 0.15, clearcoat: 1 }));
  pol1.position.y = 0.55;
  const pol1Label = dLabel('② 下偏光片', '#bfe0ff');
  pol1Label.position.set(0, 0.12, 0.55);
  lcd.add(pol1, pol1Label);

  // L3 液晶层:分子棒阵列(旋转表示偏转角度)
  const lcdLayer = new THREE.Group();
  const rods = [];
  const rodGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6);
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 9; c++) {
      const rod = new THREE.Mesh(rodGeo, MDI.mat(0xd8e4f0, { metalness: 0.1, roughness: 0.3, emissive: 0x223344, emissiveIntensity: 0.3 }));
      rod.position.set(-0.6 + c * 0.15, 0.07, -0.3 + r * 0.15);
      lcdLayer.add(rod);
      rods.push(rod);
    }
  const lcdBase = LX.geo.rbox(1.5, 0.02, 1.05, MDI.mat(0x1a2029, { roughness: 0.5 }), 0, 1);
  lcdBase.position.y = 0.01;
  lcdLayer.add(lcdBase);
  lcdLayer.position.y = 1.05;
  const lcdLabel = dLabel('③ 液晶层(分子棒随电压偏转)', '#a8e0c0');
  lcdLabel.position.set(0, 0.4, 0.55);
  lcdLayer.add(lcdLabel);
  lcd.add(lcdLayer);

  // L4 彩色滤光片:RGB 子像素网格
  const cfa = new THREE.Group();
  const RGB = [0xff3b30, 0x34c759, 0x2f7bff];
  const subGeo = new THREE.BoxGeometry(0.075, 0.015, 0.24);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 12; c++) {
      const sub = new THREE.Mesh(subGeo, new THREE.MeshStandardMaterial({
        color: RGB[c % 3], roughness: 0.35, metalness: 0,
        emissive: RGB[c % 3], emissiveIntensity: 0.35,
      }));
      sub.position.set(-0.69 + c * 0.115, 0.008, (r - 1.5) * 0.26);
      cfa.add(sub);
    }
  cfa.position.y = 1.6;
  const cfaLabel = dLabel('④ 彩色滤光片(RGB 子像素)', '#ffd0d0');
  cfaLabel.position.set(0, 0.25, 0.55);
  cfa.add(cfaLabel);
  lcd.add(cfa);

  // L5 上偏光片
  const pol2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 1.05),
    new THREE.MeshPhysicalMaterial({ color: 0x9fc4e8, transparent: true, opacity: 0.32, roughness: 0.15, clearcoat: 1 }));
  pol2.position.y = 2.15;
  const pol2Label = dLabel('⑤ 上偏光片', '#bfe0ff');
  pol2Label.position.set(0, 0.12, 0.55);
  lcd.add(pol2, pol2Label);
  g.add(lcd);

  /* ================= OLED 对比(右,x=+1.55) ================= */
  const oled = new THREE.Group();
  oled.position.set(1.55, 0, 0);
  const oledBase = LX.geo.rbox(1.5, 0.08, 1.05, MDI.mat(0x0a0c10, { metalness: 0.3, roughness: 0.5 }), 0.01, 1);
  oledBase.position.y = 0.05;
  oled.add(oledBase);
  const oledLabel = dLabel('OLED:无背光 · 自发光', '#c9b0ff');
  oledLabel.position.set(0, 0.42, 0.55);
  oled.add(oledLabel);
  const subO = [];
  const oledSubGeo = new THREE.BoxGeometry(0.075, 0.02, 0.24);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 12; c++) {
      const sm = new THREE.MeshStandardMaterial({
        color: RGB[c % 3], roughness: 0.35,
        emissive: RGB[c % 3], emissiveIntensity: 1.2,
      });
      const sub = new THREE.Mesh(oledSubGeo, sm);
      sub.position.set(-0.69 + c * 0.115, 0.1, (r - 1.5) * 0.26);
      oled.add(sub);
      subO.push({ mesh: sub, mat: sm, base: 1.2, col: c % 3 });
    }
  g.add(oled);

  /* ================= Framebuffer 逐行扫描面板(前中央) ================= */
  const fb = new THREE.Group();
  fb.position.set(0, 0, 1.75);
  const FW = 2.2, FH = 1.3;
  const fbFrame = LX.geo.rbox(FW + 0.08, FH + 0.08, 0.05, MDI.mat(0x23272e, { metalness: 0.5, roughness: 0.4 }), 0.012, 1);
  fbFrame.position.y = 0.75;
  fb.add(fbFrame);
  const fbCanvas = document.createElement('canvas');
  fbCanvas.width = 352; fbCanvas.height = 208;
  const fg = fbCanvas.getContext('2d');
  const fbTex = new THREE.CanvasTexture(fbCanvas);
  fbTex.encoding = THREE.sRGBEncoding;
  const fbScreen = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH),
    new THREE.MeshBasicMaterial({ map: fbTex }));
  fbScreen.position.set(0, 0.75, 0.028);
  fb.add(fbScreen);
  const fbLabel = dLabel('Framebuffer → 像素(逐行扫描)', '#8fd4ff');
  fbLabel.position.set(0, 1.52, 0);
  fb.add(fbLabel);
  const hzLabel = dLabel('60 Hz', '#51e88c');
  hzLabel.position.set(0, 0.12, 0);
  fb.add(hzLabel);
  g.add(fb);

  /* ----- 扫描状态机 ----- */
  let hz = 60;              // 每秒扫过的"遍"数
  let scanY = 0;            // 0..1 扫描位置
  let oledPulse = 0;

  function drawFB(sweepT) {
    const W = 352, H = 208;
    fg.fillStyle = '#05070c';
    fg.fillRect(0, 0, W, H);
    const scanRow = Math.floor(sweepT * H);
    // 最终画面:渐变天空 + 太阳 + 山
    for (let y = 0; y < H; y += 2) {
      const t = y / H;
      if (y > scanRow) continue; // 未扫描:暗
      const r = Math.floor(30 + t * 90), gr = Math.floor(60 + t * 60), b2 = Math.floor(120 + t * 80);
      fg.fillStyle = `rgb(${r},${gr},${b2})`;
      fg.fillRect(0, y, W, 2);
    }
    if (scanRow > 120) { // 已扫过的区域绘制山形
      fg.fillStyle = '#2b3a2f';
      fg.beginPath();
      fg.moveTo(0, H); fg.lineTo(70, 150); fg.lineTo(150, 190); fg.lineTo(230, 140); fg.lineTo(310, 195); fg.lineTo(W, 170); fg.lineTo(W, H);
      fg.closePath(); fg.fill();
      fg.fillStyle = '#ffd75e';
      fg.beginPath(); fg.arc(270, 70, 18, 0, 7); fg.fill();
    }
    // 扫描光带
    fg.fillStyle = 'rgba(255,255,255,0.95)';
    fg.fillRect(0, Math.max(scanRow - 3, 0), W, 4);
    fg.fillStyle = 'rgba(120,220,255,0.25)';
    fg.fillRect(0, Math.max(scanRow - 16, 0), W, 14);
    // 行号
    fg.font = '16px monospace';
    fg.fillStyle = '#8fd4ff';
    fg.fillText(`row ${scanRow}/${H}`, 10, Math.min(scanRow + 22, H - 8));
    fbTex.needsUpdate = true;
  }

  g.userData.tick = (dt, t) => {
    // 扫描推进:hz 越高扫描越快
    scanY += dt * hz * 0.5;
    if (scanY >= 1) scanY -= 1;
    drawFB(scanY);

    // 液晶分子棒:波状旋转(施加电压)
    rods.forEach((rod, i) => {
      rod.rotation.y = Math.sin(t * 2.2 + i * 0.35) * 0.9;
      rod.rotation.z = 0.5 + Math.sin(t * 1.4 + i * 0.2) * 0.25;
    });

    // OLED 演示:像素级控光——随机子像素周期性熄灭(纯黑)
    oledPulse += dt;
    if (oledPulse > 0.12) {
      oledPulse = 0;
      for (const s of subO) {
        const on = Math.random() > 0.18;
        s.mat.emissiveIntensity = on ? s.base : 0.0;
        s.mat.color.setHex(on ? RGB[s.col] : 0x000000);
      }
    }

    // LED 背光呼吸
    ledMat.emissiveIntensity = 1.4 + Math.sin(t * 2.6) * 0.25;
  };

  /* ----- API(UI 面板) ----- */
  g.userData.api = {
    setHz(v) {
      hz = v;
      const el = document.getElementById('hz-label');
      if (el) {
        el.textContent = `${v} Hz`;
        el.style.color = v >= 120 ? '#ffd75e' : '#51e88c';
      }
      const st = document.getElementById('cache-status');
      if (st) st.textContent = `刷新率 ${v}Hz:扫描周期 ${(1 / v).toFixed(3)}s——高刷新率 = 同样内容每秒被"重画"更多遍,运动更顺滑`;
    },
  };
  return g;
};
