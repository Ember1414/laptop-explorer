/* ============================================================
 * models/power/battery.js — 电池
 * package()   软包电芯:圆角矩形、哑光银色外皮、极耳与排气阀
 * buildCore() 内部下钻:正极/隔膜/负极/隔膜的**螺旋卷绕结构**
 *             (jelly roll:分层箔带沿阿基米德螺旋卷绕成圆柱,
 *              不是简单平铺三层),
 *             锂离子(发光小球)沿隔膜孔隙在正负极间迁移,
 *             路径带随机扰动(布朗运动感);UI 可切换 充电/放电。
 * 覆盖 UI:data-node="battery"(充电/放电按钮)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.battery = {};

const MBA = LX.materials;

/* ---------- 层 1:软包电芯封装 ---------- */
LX.models.battery.package = function () {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const cellG = new THREE.Group();
    const cell = LX.geo.rbox(0.5, 0.075, 1.05, MBA.pouch(), 0.02, 2); // 哑光银软包
    cell.position.set((i - 1.5) * 0.55, 0.0375, 0);
    const label = LX.geo.rbox(0.3, 0.006, 0.5, MBA.mat(0x8a8f98, { metalness: 0.4, roughness: 0.55, roughnessMap: LX.textures.grain() }), 0.003, 1);
    label.position.set((i - 1.5) * 0.55, 0.079, 0.1);
    // 极耳(铝 tab,顶部伸出)
    const tab = LX.geo.rbox(0.06, 0.004, 0.1, MBA.mat(0xc9a227, { metalness: 0.9, roughness: 0.3 }), 0, 1);
    tab.position.set((i - 1.5) * 0.55, 0.081, -0.32);
    // 排气阀(封口小点)
    const vent = LX.geo.cyl(0.014, 0.004, MBA.mat(0x565d68, { metalness: 0.7, roughness: 0.35 }), 10);
    vent.position.set((i - 1.5) * 0.55, 0.08, -0.44);
    cellG.add(cell, label, tab, vent);
    if (i === 0) cellG.name = 'batterycore'; // 第一节电芯 = 卷芯子节点入口
    g.add(cellG);
  }
  const wire = LX.geo.rbox(0.12, 0.03, 0.08, MBA.mat(0x2b2f36), 0.008, 1);
  wire.position.set(0.85, 0.03, -0.42);
  g.add(wire);

  // 电芯参数标签 + 极性标记(第二节电芯顶面,真机软包印字)
  const labCv = document.createElement('canvas');
  labCv.width = 256; labCv.height = 128;
  const lg = labCv.getContext('2d');
  lg.fillStyle = '#c8ccd2'; lg.fillRect(0, 0, 256, 128);
  lg.fillStyle = '#2b2f36';
  lg.font = 'bold 21px monospace';
  lg.fillText('LX-Power 56Wh', 12, 30);
  lg.font = '16px monospace';
  lg.fillText('7.6V 7360mAh Li-polymer', 12, 56);
  lg.fillText('Charge 8.7V max · CE UKCA', 12, 78);
  for (let i = 0; i < 40; i++) if (Math.random() > 0.45) lg.fillRect(12 + i * 5, 92, 2.5, 26); // 条码
  lg.font = 'bold 30px monospace';
  lg.fillText('+', 224, 40);
  const labTex = new THREE.CanvasTexture(labCv);
  labTex.encoding = THREE.sRGBEncoding;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21),
    new THREE.MeshStandardMaterial({ map: labTex, roughness: 0.6, metalness: 0.05 }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(-0.275, 0.0762, 0.05);
  g.add(label);

  // 保护板(PCM)+ 极耳双引线弯管(真机软包组尾部结构)
  const pcm = LX.geo.rbox(0.16, 0.018, 0.3, MBA.pcb(), 0.004, 1);
  pcm.position.set(1.12, 0.04, -0.3);
  const pcmChip = LX.geo.rbox(0.06, 0.012, 0.06, M.chip(), 0.002, 1);
  pcmChip.position.set(1.16, 0.055, -0.24);
  const wireMatB = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.6 });
  const mkW = (pts) => new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, 0.008, 8, false),
    wireMatB);
  g.add(pcm, pcmChip,
    mkW([[0.825, 0.085, -0.32], [0.95, 0.06, -0.36], [1.06, 0.05, -0.34]]),
    mkW([[0.825, 0.085, -0.28], [0.95, 0.06, -0.26], [1.06, 0.05, -0.28]]),
  );
  return g;
};

/* ---------- 层 2:jelly roll 卷绕结构 + 锂离子迁移 ---------- */
LX.models.battery.buildCore = function () {
  const g = new THREE.Group();

  // 软包外壳(切开展示:底 + 三面壁,正面开口看卷芯)
  const shellMat = MBA.mat(0xb5bac2, { metalness: 0.35, roughness: 0.5, roughnessMap: LX.textures.grain() });
  const shellBack = LX.geo.rbox(1.5, 0.95, 0.06, shellMat, 0.02, 2);
  shellBack.position.set(0, 0.5, -0.6);
  const shellL = LX.geo.rbox(0.06, 0.95, 1.26, shellMat, 0.02, 2);
  shellL.position.set(-0.72, 0.5, 0.03);
  const shellR = shellL.clone();
  shellR.position.x = 0.72;
  const shellBottom = LX.geo.rbox(1.5, 0.06, 1.26, shellMat, 0.02, 2);
  shellBottom.position.set(0, 0.03, 0.03);
  g.add(shellBack, shellL, shellR, shellBottom);

  // ----- jelly roll:阿基米德螺旋卷绕 -----
  // 螺旋 r(θ) = r0 + b·θ,箔带沿切向排布;四种带材 InstancedMesh
  const TURNS = 2.6, TH_MAX = TURNS * Math.PI * 2, STEP = 0.16;
  const R0 = 0.14, B = (0.46 - R0) / TH_MAX;
  const ROLL_LEN = 1.25, ROLL_Y = 0.52, ROLL_Z = -0.12;
  // 四种带材(由内向外一个周期):正极(蓝灰涂层) / 隔膜(白) / 负极(红铜涂层) / 隔膜(白)
  const stripDefs = [
    { t: 0.010, mat: MBA.mat(0x4a5a78, { metalness: 0.6, roughness: 0.4 }) },  // 正极
    { t: 0.005, mat: MBA.mat(0xe8e8e2, { roughness: 0.7, metalness: 0 }) },    // 隔膜
    { t: 0.010, mat: MBA.mat(0x8a5a3a, { metalness: 0.65, roughness: 0.4 }) }, // 负极
    { t: 0.005, mat: MBA.mat(0xe8e8e2, { roughness: 0.7, metalness: 0 }) },    // 隔膜
  ];
  const cycleT = stripDefs.reduce((a, s) => a + s.t, 0); // 一个周期总厚
  const STEPS = Math.floor(TH_MAX / STEP);
  const insts = stripDefs.map(sd => ({
    mesh: new THREE.InstancedMesh(new THREE.BoxGeometry(ROLL_LEN, sd.t, 1), sd.mat, STEPS),
    t: sd.t,
  }));
  // 螺旋排布:沿 θ 累积径向厚度,按周期轮流放四种带材
  let rad = R0, th = 0, k = 0;
  const d = new THREE.Object3D();
  while (th < TH_MAX) {
    const idx = k % 4;
    const t = stripDefs[idx].t;
    const midR = rad + t / 2;
    const off = stripDefs.slice(0, idx).reduce((a, s2) => a + s2.t, 0);
    for (let si = 0; si < 4; si++) {
      const inst = insts[si];
      const rr = rad + off + inst.t / 2;
      // 卷轴沿 x:截面在 y-z 平面,条带沿切向、厚度沿径向
      d.position.set(0, ROLL_Y + Math.sin(th) * rr, ROLL_Z + Math.cos(th) * rr);
      d.rotation.set(Math.PI / 2, 0, -th);
      d.updateMatrix();
      inst.mesh.setMatrixAt(k, d.matrix);
    }
    rad += t;
    th = Math.min(TH_MAX, (rad - R0) / B); // 外圈角步更小(弧长一致)
    k++;
  }
  // 实例计数 = 实际步数
  insts.forEach(inst => { inst.mesh.count = k; inst.mesh.instanceMatrix.needsUpdate = true; });
  insts.forEach(inst => g.add(inst.mesh));

  // 极耳(内圈正极耳 / 外圈负极耳)
  const tabIn = LX.geo.rbox(0.05, 0.16, 0.08, MBA.mat(0xc9a227, { metalness: 0.9, roughness: 0.3 }), 0.004, 1);
  tabIn.position.set(0, ROLL_Y + R0 + 0.05, ROLL_Z + R0 * 0.6);
  const tabOut = tabIn.clone();
  tabOut.position.set(0, ROLL_Y - 0.05, ROLL_Z - 0.52);
  tabOut.material = MBA.mat(0x8a5a3a, { metalness: 0.8, roughness: 0.35 });
  g.add(tabIn, tabOut);

  /* ----- 锂离子:发光小球沿隔膜孔隙迁移(带布朗扰动) ----- */
  const N = 42;
  const liMat = new THREE.MeshStandardMaterial({ color: 0x9fffc8, emissive: 0x2fd48a, emissiveIntensity: 1.8, roughness: 0.3 });
  const liMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 8), liMat, N);
  g.add(liMesh);
  const parts = [];
  const rnd = LX.textures.random(77);
  for (let i = 0; i < N; i++) {
    parts.push({
      th: rnd() * TH_MAX,
      p: rnd(),                 // 0=正极侧 → 1=负极侧(穿过隔膜)
      jx: (rnd() - 0.5) * 0.02, jz: (rnd() - 0.5) * 0.02,
      sp: 0.18 + rnd() * 0.22,
    });
  }
  let mode = 'charge';          // charge: 正→负 | discharge: 负→正
  const pos = new THREE.Vector3();

  g.userData.tick = (dt, t) => {
    const d2 = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const pt = parts[i];
      pt.p += (mode === 'charge' ? 1 : -1) * pt.sp * dt;
      if (pt.p > 1.05) { pt.p = -0.05; pt.th = rnd2(pt.th); }
      if (pt.p < -0.05) { pt.p = 1.05; pt.th = rnd2(pt.th); }
      // 布朗扰动(随机游走 + 回中)
      pt.jx += (rnd() - 0.5) * dt * 0.5 - pt.jx * dt * 2;
      pt.jz += (rnd() - 0.5) * dt * 0.5 - pt.jz * dt * 2;
      const rr = R0 + B * pt.th;
      const nx = Math.sin(pt.th), nz = Math.cos(pt.th); // 径向单位向量(近似)
      // 径向位置:0 = 贴着正极,1 = 穿过隔膜到负极
      const off = (pt.p - 0.5) * cycleT;
      const rC = R0 + B * pt.th + cycleT / 2 + off;
      pos.set(0, ROLL_Y + nx * rC + pt.jx, ROLL_Z + nz * rC + pt.jz);
      d2.position.copy(pos);
      d2.scale.setScalar(0.8 + Math.sin(t * 6 + i) * 0.15);
      d2.updateMatrix();
      liMesh.setMatrixAt(i, d2.matrix);
    }
    liMesh.instanceMatrix.needsUpdate = true;
    const el = document.getElementById('battery-status');
    if (el) el.textContent = mode === 'charge'
      ? '充电中:锂离子从正极穿过隔膜迁移到负极(石墨层)'
      : '放电中:锂离子从负极脱嵌,返回正极——电流对外做功';
  };
  function rnd2(cur) { return (cur + (Math.random() - 0.5) * 2 + TH_MAX) % TH_MAX; }

  g.userData.api = {
    setMode(m) { mode = m === 'discharge' ? 'discharge' : 'charge'; },
    get mode() { return mode; },
  };
  return g;
};
