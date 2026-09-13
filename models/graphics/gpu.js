/* ============================================================
 * models/graphics/gpu.js — GPU 芯片
 * 比 CPU 更大的裸片 + 环绕四周的 GDDR 显存颗粒 + 高密度走线区。
 * 板上组名 'gpu' = 子节点入口(下钻光栅化管线与显示面板)。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.gpu = {};

// GPU 专用 die 纹理:着色器核心阵列更密集、更均匀
let _gpuDie = null;
LX.models.gpu.dieTexture = function () {
  if (_gpuDie) return _gpuDie;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = LX.textures.random(21);
  g.fillStyle = '#0d1119';
  g.fillRect(0, 0, S, S);
  // 大面积着色器核心阵列(规律网格,比 CPU 更密)
  for (let zx = 0; zx < 4; zx++)
    for (let zy = 0; zy < 3; zy++) {
      const x = 24 + zx * 122, y = 20 + zy * 160, w = 108, h = 144;
      g.fillStyle = zx % 2 === zy % 2 ? '#152338' : '#131f30';
      g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(150,200,255,0.28)';
      g.strokeRect(x, y, w, h);
      g.save();
      g.beginPath(); g.rect(x, y, w, h); g.clip();
      for (let i = x + 4; i < x + w; i += 5) {
        g.strokeStyle = 'rgba(120,190,255,0.22)';
        g.beginPath(); g.moveTo(i, y); g.lineTo(i, y + h); g.stroke();
      }
      for (let j = y + 4; j < y + h; j += 5) {
        g.strokeStyle = 'rgba(170,150,255,0.14)';
        g.beginPath(); g.moveTo(x, j); g.lineTo(x + w, j); g.stroke();
      }
      g.restore();
    }
  // 中间显存控制器条带
  g.fillStyle = '#1c2a1e';
  g.fillRect(24, 210, 460, 80);
  g.strokeStyle = 'rgba(200,220,255,0.3)';
  g.strokeRect(24, 210, 460, 80);
  g.font = '16px monospace';
  g.fillStyle = 'rgba(200,230,255,0.7)';
  g.fillText('LX GPU · 5120 ALU · GDDR6X', 60, 256);
  _gpuDie = new THREE.CanvasTexture(c);
  _gpuDie.encoding = THREE.sRGBEncoding;
  return _gpuDie;
};

LX.models.gpu.build = function () {
  const M = LX.materials;
  const g = new THREE.Group();
  g.name = 'gpu'; // 主板上的子节点入口

  // GPU 基板(比 CPU 大)
  const substrate = LX.geo.rbox(1.0, 0.018, 0.9, M.mat(0x35604a, { metalness: 0.2, roughness: 0.6 }), 0.008, 1);
  substrate.position.y = 0.009;
  g.add(substrate);

  // 大裸片(GPU 专用纹理)
  const die = LX.geo.rbox(0.62, 0.026, 0.52,
    M.mat(0xffffff, {
      map: LX.models.gpu.dieTexture(), metalness: 0.35, roughness: 0.26,
      emissive: 0x0c1626, emissiveIntensity: 0.5,
    }), 0.005, 1);
  die.position.y = 0.031;
  die.name = 'raster'; // 裸片 = 光栅化管线子节点入口(板上复用时无副作用)
  g.add(die);

  // GDDR 显存颗粒:环绕裸片四周(上 2 下 2)
  const gddrMat = M.mat(0x171a20, { metalness: 0.25, roughness: 0.55, roughnessMap: LX.textures.grain() });
  const gddrPos = [[-0.3, -0.34], [0.06, -0.34], [-0.3, 0.34], [0.06, 0.34]];
  gddrPos.forEach(([x, z], i) => {
    const chip = LX.geo.rbox(0.26, 0.03, 0.16, gddrMat, 0.005, 1);
    chip.position.set(x + 0.12, 0.034, z);
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const cg = cv.getContext('2d');
    cg.fillStyle = '#171a20'; cg.fillRect(0, 0, 128, 64);
    cg.fillStyle = '#8fa0b8'; cg.font = 'bold 20px monospace';
    cg.fillText('GDDR6', 18, 40);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.14),
      M.mat(0xffffff, { map: tex, roughness: 0.5, metalness: 0.1 }));
    face.rotation.x = -Math.PI / 2;
    face.position.set(x + 0.12, 0.05, z);
    g.add(chip, face);
    void i;
  });

  // 供电小电感排(GPU 上方一排)
  for (let i = 0; i < 4; i++) {
    const ind = LX.geo.cyl(0.022, 0.03, M.mat(0x1b1d22, { metalness: 0.3, roughness: 0.7, roughnessMap: LX.textures.grain() }), 12);
    ind.position.set(-0.4 + i * 0.1, 0.05, -0.18);
    g.add(ind);
  }

  return g;
};

/* ---------- GPU 节点模型:封装 + 旁侧迷你显示面板('display' 入口) ---------- */
LX.models.gpu.buildNode = function () {
  const g = LX.models.gpu.build();
  const M = LX.materials;

  const panel = new THREE.Group();
  panel.name = 'display';
  const stand = LX.geo.cyl(0.03, 0.22, M.mat(0x2b2f36, { metalness: 0.5, roughness: 0.4 }), 12);
  stand.position.set(-0.95, 0.11, -0.72);
  const base = LX.geo.rbox(0.3, 0.02, 0.2, M.mat(0x2b2f36, { metalness: 0.5, roughness: 0.4 }), 0.008, 1);
  base.position.set(-0.95, 0.01, -0.72);
  const bezel = LX.geo.rbox(0.62, 0.4, 0.03, M.mat(0x1c2026, { metalness: 0.4, roughness: 0.5, roughnessMap: LX.textures.grain() }), 0.012, 2);
  bezel.position.set(-0.95, 0.42, -0.72);
  // 自发光画面(输出帧示意,Bloom 拾取)
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 96;
  const cg = cv.getContext('2d');
  cg.fillStyle = '#04101c'; cg.fillRect(0, 0, 128, 96);
  for (let i = 0; i < 5; i++) cg.fillRect(8 + i * 24, 60, 18, 28);
  cg.fillStyle = '#4cc2ff'; cg.fillRect(8, 12, 60, 8);
  cg.fillStyle = '#ffd75e'; cg.fillRect(8, 28, 40, 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.32),
    new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9,
      roughness: 0.2, metalness: 0,
    }));
  screen.position.set(-0.95, 0.42, -0.703);
  panel.add(base, stand, bezel, screen);
  g.add(panel);
  return g;
};
