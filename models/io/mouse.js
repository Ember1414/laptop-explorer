/* ============================================================
 * models/io/mouse.js — 外接光学鼠标
 * build()        整机旁的外观(人体工学壳体 + 滚轮 + 分键缝 + 光学孔)
 * buildDetail()  下钻:分解视图 + 工作原理
 *   LED 照亮表面 → 微观纹理经铁氧体镜头 → CMOS 图像阵列(数千帧/秒)
 *   → DSP 对比连续帧位移 → X/Y 计数;滚轮 = 光栅编码器;按键 = 微动开关。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.mouse = {};

const MMO = LX.materials;

function mLabel(text, color, scale) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 56;
  const g = c.getContext('2d');
  g.font = 'bold 26px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 160, 38);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 10;
  sp.scale.set(scale || 0.5, (scale || 0.5) * 0.175, 1);
  return sp;
}

/* ---------- 整机旁的外观 ---------- */
LX.models.mouse.build = function () {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18),
    MMO.mat(0x262b33, { metalness: 0.3, roughness: 0.45, roughnessMap: LX.textures.grain() }));
  body.scale.set(0.85, 0.55, 1.25); // 人体工学长椭球
  body.position.y = 0.075;
  const base = LX.geo.rbox(0.24, 0.015, 0.34, MMO.mat(0x1a1e24, { roughness: 0.6 }), 0.012, 1);
  base.position.y = 0.008;
  const seam = LX.geo.rbox(0.072, 0.004, 0.006, MMO.mat(0x101318, { roughness: 0.7 }), 0, 1);
  seam.position.set(0, 0.128, 0.155); // 分键缝(前部)
  const seamL = LX.geo.rbox(0.006, 0.004, 0.12, MMO.mat(0x101318, { roughness: 0.7 }), 0, 1);
  seamL.position.set(-0.036, 0.122, 0.09);
  seamL.rotation.y = 0.2;
  const seamR = seamL.clone();
  seamR.position.x = 0.036;
  seamR.rotation.y = -0.2;
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.026, 18),
    MMO.mat(0x353b44, { roughness: 0.5, metalness: 0.25 }));
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(0, 0.126, 0.075);
  const aperture = LX.geo.cyl(0.026, 0.004,
    MMO.mat(0x30080a, { emissive: 0xff2020, emissiveIntensity: 0.7, roughness: 0.3 }), 16);
  aperture.position.set(0, 0.003, -0.07);
  g.add(body, base, seam, seamL, seamR, wheel, aperture);
  return g;
};

/* ---------- 下钻:分解视图 + 工作原理(清晰四层) ----------
 * 表面纹理(底) → 底壳+LED+镜头(下) → PCB:CMOS/DSP/编码器/微动(中) → 上壳+滚轮(上)
 * 发光光路示意线:LED → 表面 → 镜头 → CMOS */
LX.models.mouse.buildDetail = function () {
  const g = new THREE.Group();
  const S = 1.7;
  g.scale.setScalar(S);

  // 第 1 层:表面微观纹理(滚动 = 鼠标相对移动)
  const surfCv = document.createElement('canvas');
  surfCv.width = 256; surfCv.height = 256;
  const sg = surfCv.getContext('2d');
  sg.fillStyle = '#20262e'; sg.fillRect(0, 0, 256, 256);
  const rnd = LX.textures.random(12);
  for (let i = 0; i < 500; i++) {
    sg.fillStyle = `rgba(140,170,200,${0.15 + rnd() * 0.3})`;
    sg.fillRect(rnd() * 256, rnd() * 256, 1.6, 1.6);
  }
  const surfTex = new THREE.CanvasTexture(surfCv);
  surfTex.wrapS = surfTex.wrapT = THREE.RepeatWrapping;
  surfTex.repeat.set(2, 2);
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4),
    new THREE.MeshBasicMaterial({ map: surfTex }));
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(0, 0, -0.02);

  // 第 2 层:底壳 + LED + 铁氧体镜头 + 脚贴
  const base = LX.geo.rbox(0.24, 0.015, 0.34, MMO.mat(0x1a1e24, { roughness: 0.6 }), 0.012, 1);
  base.position.set(0, 0.05, -0.02);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xff4040, emissive: 0xff2020, emissiveIntensity: 2.0, roughness: 0.3 }));
  led.position.set(0, 0.06, -0.11);
  const lens = LX.geo.rbox(0.05, 0.012, 0.05,
    new THREE.MeshPhysicalMaterial({ color: 0x2a1a10, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.6 }), 0, 1);
  lens.position.set(0, 0.058, -0.02);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.05, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(0, 0.033, -0.11);
  beam.rotation.x = Math.PI;

  // 第 3 层:PCB(CMOS 朝下对准镜头 / DSP / 编码器 / 微动开关 ×2)
  const pcb = LX.geo.rbox(0.22, 0.012, 0.3, MMO.pcb(), 0.006, 1);
  pcb.position.set(0, 0.3, -0.02);
  const cmos = LX.geo.rbox(0.08, 0.014, 0.08, MMO.chip(), 0.003, 1);
  cmos.position.set(0, 0.315, -0.02);
  const cmosLens = LX.geo.cyl(0.022, 0.014,
    new THREE.MeshPhysicalMaterial({ color: 0x181008, roughness: 0.05, clearcoat: 1 }), 14);
  cmosLens.position.set(0, 0.278, -0.02);
  const dsp = LX.geo.rbox(0.1, 0.012, 0.1, MMO.chip(), 0.003, 1);
  dsp.position.set(0, 0.315, 0.09);
  const encoder = LX.geo.cyl(0.02, 0.02, MMO.mat(0x2e333b, { metalness: 0.3, roughness: 0.4 }), 14);
  encoder.position.set(0, 0.317, 0.075);
  for (const sx of [-0.07, 0.07]) {
    const sw = LX.geo.rbox(0.05, 0.014, 0.05, MMO.mat(0x1f2329, { metalness: 0.4, roughness: 0.4 }), 0.002, 1);
    sw.position.set(sx, 0.314, 0.1);
    const swPin = LX.geo.cyl(0.004, 0.012, MMO.mat(0xc9a227, { metalness: 0.9, roughness: 0.3 }), 8);
    swPin.position.set(sx, 0.3, 0.1);
    g.add(sw, swPin);
  }

  // 第 4 层:上壳(半透明剖视)+ 滚轮(半嵌于顶面)
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2 + 0.25),
    MMO.mat(0x262b33, { metalness: 0.3, roughness: 0.45, roughnessMap: LX.textures.grain(), transparent: true, opacity: 0.88 }));
  shell.scale.set(0.85, 0.55, 1.25);
  shell.position.y = 0.62;
  const seam = LX.geo.rbox(0.072, 0.004, 0.006, MMO.mat(0x101318, { roughness: 0.7 }), 0, 1);
  seam.position.set(0, 0.7, 0.19);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.026, 18),
    MMO.mat(0x353b44, { roughness: 0.5, metalness: 0.25 }));
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(0, 0.7, 0.1);

  // 光路示意线(LED → 表面;表面 → 镜头 → CMOS)
  const pathMat = new THREE.LineBasicMaterial({ color: 0xff6050, transparent: true, opacity: 0.75 });
  const pathPts = [
    new THREE.Vector3(0, 0.055, -0.11), new THREE.Vector3(0, 0.008, -0.11),
    new THREE.Vector3(0, 0.008, -0.11), new THREE.Vector3(0, 0.275, -0.02),
  ];
  const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPts);
  const pathLine = new THREE.Line(pathGeo, pathMat);
  g.add(pathLine);

  g.add(surf, base, led, lens, beam, pcb, cmos, cmosLens, dsp, encoder, shell, seam, wheel);

  // 标签(缩小 + 两侧错位排布,不遮挡示意图)
  const l1 = mLabel('LED 照明', '#ff8080', 0.42); l1.position.set(-0.34, 0.07, -0.14);
  const l2 = mLabel('表面微观纹理', '#9fb8d8', 0.5); l2.position.set(0, 0.03, 0.28);
  const l3 = mLabel('铁氧体镜头', '#cfe0ee', 0.42); l3.position.set(0.34, 0.27, -0.02);
  const l4 = mLabel('CMOS 图像阵列', '#8fd4ff', 0.5); l4.position.set(-0.36, 0.36, -0.05);
  const l5 = mLabel('DSP 位移对比', '#ffd75e', 0.45); l5.position.set(0.34, 0.38, 0.16);
  const l6 = mLabel('微动开关', '#9fe8b5', 0.4); l6.position.set(-0.32, 0.3, 0.12);
  const l7 = mLabel('滚轮编码器', '#c79fff', 0.42); l7.position.set(0.05, 0.84, 0.1);
  g.add(l1, l2, l3, l4, l5, l6, l7);

  g.userData.tick = (dt, t) => {
    // LED 脉冲 + 光锥闪烁
    led.material.emissiveIntensity = 1.6 + Math.sin(t * 6) * 0.6;
    beam.material.opacity = 0.2 + Math.sin(t * 6) * 0.12;
    pathMat.opacity = 0.55 + Math.sin(t * 6) * 0.25;
    // 表面纹理滚动(模拟鼠标移动 → 图像阵列看到纹理滑过)
    surfTex.offset.y = (t * 0.25) % 1;
    surfTex.offset.x = (t * 0.11) % 1;
    // CMOS 采样闪烁
    cmos.material.emissive.setHex(Math.sin(t * 18) > 0 ? 0x2a5a78 : 0x0a1218);
    cmos.material.emissiveIntensity = 0.8;
  };
  return g;
};
