/* ============================================================
 * models/mainboard/audioCodec.js — 音频编解码芯片(Codec)
 * 模拟波形 ↔ 数字采样点的双向转换对比:
 *   ADC(录音):连续正弦波 → 采样点(离散竖线)→ 阶梯状量化电平
 *   DAC(播放):数字采样 → 平滑重建的模拟波形(通过低通滤波)
 * 面板 CanvasTexture 逐帧绘制;芯片本体 + 晶振。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.audioCodec = {};

const MAC = LX.materials;

function acLabel(text, color, scale) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 72;
  const g = c.getContext('2d');
  g.font = 'bold 32px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 160, 48);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(scale || 0.9, (scale || 0.9) * 0.21, 1);
  return sp;
}

// 板载小芯片(供主板挂载为 'codec' 入口)
LX.models.audioCodec.buildChip = function () {
  const g = new THREE.Group();
  const body = LX.geo.rbox(0.42, 0.045, 0.42, MAC.chip(), 0.006, 1);
  body.position.y = 0.075;
  g.add(body);
  const pinT = [];
  for (let side = 0; side < 4; side++)
    for (let i = 0; i < 8; i++) {
      const off = -0.16 + i * 0.046;
      const p = { p: [0, 0, 0], r: [0, side * Math.PI / 2, 0] };
      if (side === 0) p.p = [off, 0.028, 0.23];
      if (side === 1) p.p = [0.23, 0.028, off];
      if (side === 2) p.p = [off, 0.028, -0.23];
      if (side === 3) p.p = [-0.23, 0.028, off];
      pinT.push(p);
    }
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.032, 0.014, 0.018),
    MAC.mat(0xb9bec6, { metalness: 0.85, roughness: 0.3 }), pinT));
  const xtal = LX.geo.cyl(0.035, 0.03, MAC.mat(0x8a8f98, { metalness: 0.85, roughness: 0.3 }), 14);
  xtal.position.set(0.34, 0.065, 0.14);
  g.add(xtal);
  return g;
};

LX.models.audioCodec.build = function () {
  const g = new THREE.Group();

  // 芯片本体(方形,细间距引脚)
  const body = LX.geo.rbox(0.42, 0.045, 0.42, MAC.chip(), 0.006, 1);
  body.position.y = 0.075;
  g.add(body);
  // 四边细引脚(InstancedMesh)
  const pinT = [];
  for (let side = 0; side < 4; side++)
    for (let i = 0; i < 8; i++) {
      const off = -0.16 + i * 0.046;
      const p = { p: [0, 0, 0], r: [0, side * Math.PI / 2, 0] };
      if (side === 0) p.p = [off, 0.028, 0.23];
      if (side === 1) p.p = [0.23, 0.028, off];
      if (side === 2) p.p = [off, 0.028, -0.23];
      if (side === 3) p.p = [-0.23, 0.028, off];
      pinT.push(p);
    }
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.032, 0.014, 0.018),
    MAC.mat(0xb9bec6, { metalness: 0.85, roughness: 0.3 }), pinT));
  // 晶振(金属小圆柱,旁边)
  const xtal = LX.geo.cyl(0.035, 0.03, MAC.mat(0x8a8f98, { metalness: 0.85, roughness: 0.3 }), 14);
  xtal.position.set(0.34, 0.065, 0.14);
  g.add(xtal);
  const xtalLab = acLabel('晶振 24.576MHz', '#bfe0ff', 0.55);
  xtalLab.position.set(0.34, 0.16, 0.14);
  g.add(xtalLab);

  // 转换对比面板(CanvasTexture 逐帧绘制)
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 240;
  const g2 = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.95),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.97 }));
  panel.position.set(0, 1.05, -0.4);
  g.add(panel);

  const labAdc = acLabel('ADC 录音:模拟 → 数字(采样+量化)', '#8fd4ff', 0.95);
  labAdc.position.set(0, 1.68, -0.4);
  const labCodec = acLabel('音频编解码芯片 Codec', '#c9b0ff', 0.7);
  labCodec.position.set(0, 1.42, -0.4);
  g.add(labAdc, labCodec);

  // 方向切换按钮状态(UI)
  let mode = 'adc';         // adc | dac
  let samplePhase = 0;
  let bitDepth = 4;         // 量化位深演示(4bit = 16 级)

  const SINE = (x) => Math.sin(x * Math.PI * 2) * 0.4 + Math.sin(x * Math.PI * 6 + 1) * 0.12;

  function drawPanel(t) {
    const W = 512, H = 240;
    g2.fillStyle = '#05080c';
    g2.fillRect(0, 0, W, H);
    g2.strokeStyle = 'rgba(120,180,255,0.35)';
    g2.lineWidth = 2;
    g2.strokeRect(4, 4, W - 8, H - 8);
    const mid = H / 2, amp = H * 0.36;
    const cycles = 2.2;

    // 网格
    g2.strokeStyle = 'rgba(90,140,200,0.15)';
    g2.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) { g2.beginPath(); g2.moveTo(x, 6); g2.lineTo(x, H - 6); g2.stroke(); }
    g2.beginPath(); g2.moveTo(6, mid); g2.lineTo(W - 6, mid); g2.stroke();

    if (mode === 'adc') {
      // 1) 原始模拟波形(连续,青色)
      g2.strokeStyle = 'rgba(80,220,255,0.95)';
      g2.lineWidth = 2.5;
      g2.beginPath();
      for (let x = 0; x <= W - 12; x += 2) {
        const y = mid - SINE(x / W * cycles + samplePhase) * amp;
        if (x === 0) g2.moveTo(x + 6, y); else g2.lineTo(x + 6, y);
      }
      g2.stroke();
      // 2) 采样点(竖线 + 圆点)
      const N = 24;
      g2.fillStyle = '#ffd75e';
      for (let i = 0; i < N; i++) {
        const x = 6 + (i + 0.5) / N * (W - 12);
        const y = mid - SINE(x / W * cycles + samplePhase) * amp;
        g2.fillRect(x - 1, 6, 2, H - 12);
        g2.beginPath(); g2.arc(x, y, 5, 0, 7); g2.fill();
      }
      // 3) 量化电平(阶梯,绿色:每段水平保持 + 段间垂直跳变)
      g2.strokeStyle = 'rgba(80,255,140,0.95)';
      g2.lineWidth = 3;
      g2.beginPath();
      let prevQ = null;
      for (let i = 0; i < N; i++) {
        const x0 = 6 + i / N * (W - 12), x1 = 6 + (i + 1) / N * (W - 12);
        const y = mid - SINE((i + 0.5) / N * cycles + samplePhase) * amp;
        const q = Math.round(y / amp * bitDepth) / bitDepth * amp;
        g2.moveTo(x0, mid - q); g2.lineTo(x1, mid - q);
        if (prevQ !== null) { g2.moveTo(x0, mid - prevQ); g2.lineTo(x0, mid - q); }
        prevQ = q;
      }
      g2.stroke();
      g2.font = '17px monospace';
      g2.fillStyle = 'rgba(160,220,255,0.85)';
      g2.fillText('模拟声波 → 采样点 → 量化电平(位深演示 ' + bitDepth + 'bit)', 14, H - 16);
    } else {
      // DAC:数字采样点(离散)→ 平滑重建(滤波曲线)
      const N = 24;
      const samples = [];
      for (let i = 0; i < N; i++) samples.push(mid - SINE((i + 0.5) / N * cycles + samplePhase) * amp);
      // 阶梯(数字保持)
      g2.strokeStyle = 'rgba(255,215,94,0.95)';
      g2.lineWidth = 3;
      for (let i = 0; i < N; i++) {
        const x0 = 6 + i / N * (W - 12), x1 = 6 + (i + 1) / N * (W - 12);
        g2.beginPath(); g2.moveTo(x0, samples[i]); g2.lineTo(x1, samples[i]); g2.stroke();
        if (i < N - 1) { g2.beginPath(); g2.moveTo(x1, samples[i]); g2.lineTo(x1, samples[i + 1]); g2.stroke(); }
      }
      g2.fillStyle = '#ffd75e';
      for (let i = 0; i < N; i++) {
        const x = 6 + (i + 0.5) / N * (W - 12);
        g2.beginPath(); g2.arc(x, samples[i], 4.5, 0, 7); g2.fill();
      }
      // 重建平滑波形(低通滤波后,白色)
      g2.strokeStyle = 'rgba(255,255,255,0.95)';
      g2.lineWidth = 2.5;
      g2.beginPath();
      for (let x = 0; x <= W - 12; x += 2) {
        const y = mid - SINE(x / W * cycles + samplePhase) * amp;
        if (x === 0) g2.moveTo(x + 6, y); else g2.lineTo(x + 6, y);
      }
      g2.stroke();
      g2.font = '17px monospace';
      g2.fillStyle = 'rgba(255,230,160,0.9)';
      g2.fillText('数字采样 → 低通滤波 → 平滑模拟波形(播放)', 14, H - 16);
    }
    tex.needsUpdate = true;
  }

  g.userData.tick = (dt, t) => {
    samplePhase += dt * 0.9;
    drawPanel(t);
  };

  g.userData.api = {
    setMode(m) { mode = m === 'dac' ? 'dac' : 'adc'; },
    get mode() { return mode; },
  };
  return g;
};
