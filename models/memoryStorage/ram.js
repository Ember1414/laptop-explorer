/* ============================================================
 * models/memoryStorage/ram.js — 板载内存(LPDDR)
 * 三层模型:
 *   package()  焊在主板上的扁平封装(板载 'memory' 入口)
 *   array()    存储单元阵列:200×200 = 4 万单元(InstancedMesh,
 *              真实芯片为数亿,此处按 LOD 降采样展示);
 *              行/列译码器选通:光线沿行选通线/列总线传播,
 *              精确命中交叉点单元格( instanceColor 高亮,非模糊亮片)
 *   cell()     存储单元内部:1T1C(晶体管+电容),
 *              充电状态 = 电容内"填充液体"比例;带 DRAM 漏电与刷新演示
 * 覆盖 UI:data-node="ramarray"(地址输入)/ data-node="cell"(充放电按钮)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.ram = {};

const MRM = LX.materials;

/* ---------- 层 1:板载扁平封装 ---------- */
LX.models.ram.package = function () {
  const g = new THREE.Group();
  const rnd = LX.textures.random(60);
  for (let i = 0; i < 2; i++) {
    const chipG = new THREE.Group();
    // 扁平塑料封装
    const body = LX.geo.rbox(0.52, 0.032, 0.3, MRM.mat(0x171a20, { metalness: 0.25, roughness: 0.55, roughnessMap: LX.textures.grain() }), 0.006, 1);
    body.position.y = 0.016;
    // 激光印字
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 148;
    const cg = cv.getContext('2d');
    cg.fillStyle = '#171a20';
    cg.fillRect(0, 0, 256, 148);
    cg.fillStyle = '#9aa4b2';
    cg.font = 'bold 26px monospace';
    cg.fillText('LXDDR5', 24, 52);
    cg.font = '18px monospace';
    cg.fillText('8GB ' + (i ? 'B' : 'A'), 24, 86);
    cg.fillText('2666M-1G', 24, 114);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.29),
      MRM.mat(0xffffff, { map: tex, roughness: 0.55, metalness: 0.1 }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.0325;
    // 底部 BGA 焊点(InstancedMesh)
    const ballT = LX.instanced.jitterGrid({
      from: [-0.22, -0.002, -0.11], step: [0.048, 0, 0.048],
      cols: 10, rows: 5, jitterP: 0.002, jitterR: 0, scaleRange: [0.9, 1.1], seed: 61 + i,
    });
    const balls = LX.instanced.build(new THREE.SphereGeometry(0.008, 6, 6), MRM.mat(0x8a8f98, { metalness: 0.7, roughness: 0.35 }), ballT);
    chipG.add(body, face, balls);
    chipG.position.set((i - 0.5) * 0.62 + (rnd() - 0.5) * 0.01, 0, 0);
    chipG.rotation.y = (rnd() - 0.5) * 0.02;
    if (i === 0) chipG.name = 'ramarray'; // 第一颗 die = 存储阵列子节点入口
    g.add(chipG);
  }
  return g;
};

/* ---------- 层 2:存储单元阵列 + 行/列译码选通 ---------- */
const RAM_ROWS = 200, RAM_COLS = 200;

LX.models.ram.array = function () {
  const g = new THREE.Group();

  // 阵列基板
  const W = RAM_COLS * 0.016, D = RAM_ROWS * 0.016; // 3.2 × 3.2
  const sub = LX.geo.rbox(W + 0.5, 0.06, D + 0.5, MRM.mat(0x14181f, { metalness: 0.4, roughness: 0.55, roughnessMap: LX.textures.grain() }), 0.02, 1);
  sub.position.y = 0.03;
  g.add(sub);

  // 4 万个存储单元(InstancedMesh + 微扰动)
  const cellGeo = new THREE.BoxGeometry(0.011, 0.01, 0.011);
  const cellMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 });
  const cells = new THREE.InstancedMesh(cellGeo, cellMat, RAM_ROWS * RAM_COLS);
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  const rnd = LX.textures.random(88);
  let k = 0;
  for (let r = 0; r < RAM_ROWS; r++)
    for (let c = 0; c < RAM_COLS; c++) {
      d.position.set((c - (RAM_COLS - 1) / 2) * 0.016, 0.07, (r - (RAM_ROWS - 1) / 2) * 0.016);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(0.9 + rnd() * 0.2);
      d.updateMatrix();
      cells.setMatrixAt(k, d.matrix);
      col.setHex(0x2a3340).multiplyScalar(0.85 + rnd() * 0.3);
      cells.setColorAt(k, col);
      k++;
    }
  cells.instanceMatrix.needsUpdate = true;
  cells.instanceColor.needsUpdate = true;
  g.add(cells);

  // 行译码器(左)/ 列译码器(上)
  const rowDec = LX.geo.rbox(0.14, 0.16, D * 0.9, MRM.mat(0x2b313a, { metalness: 0.5, roughness: 0.45, roughnessMap: LX.textures.grain() }), 0.01, 1);
  rowDec.position.set(-W / 2 - 0.16, 0.1, 0);
  const colDec = LX.geo.rbox(W * 0.9, 0.16, 0.14, MRM.mat(0x2b313a, { metalness: 0.5, roughness: 0.45, roughnessMap: LX.textures.grain() }), 0.01, 1);
  colDec.position.set(0, 0.1, -D / 2 - 0.16);
  g.add(rowDec, colDec);

  // 行/列选通光线(细长亮条,动画时从译码器生长到目标行/列)
  const rowBar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.018, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0 }));
  const colBar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.018, 1),
    new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0 }));
  g.add(rowBar, colBar);

  // 命中单元的指示针
  const hitPin = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.12, 12),
    new THREE.MeshBasicMaterial({ color: 0x51e88c, transparent: true, opacity: 0 }));
  hitPin.rotation.x = Math.PI;
  g.add(hitPin);

  // 角落"样板单元"('cell' 子节点入口:1T1C 内部,真实几何替代发光球)
  const cellMark = new THREE.Group();
  cellMark.name = 'cell';
  const cellBase = LX.geo.rbox(0.16, 0.05, 0.16, MRM.mat(0x2b313a, { metalness: 0.5, roughness: 0.45 }), 0.008, 1);
  cellBase.position.set(W / 2 + 0.12, 0.085, D / 2 + 0.12);
  const cellTop = LX.geo.rbox(0.07, 0.05, 0.07,
    MRM.mat(0x2fd48a, { emissive: 0x1f8f56, emissiveIntensity: 1.1, roughness: 0.3 }), 0.006, 1);
  cellTop.position.set(W / 2 + 0.12, 0.135, D / 2 + 0.12);
  const cellCv = document.createElement('canvas');
  cellCv.width = 128; cellCv.height = 64;
  const cellCg = cellCv.getContext('2d');
  cellCg.font = 'bold 30px monospace'; cellCg.textAlign = 'center';
  cellCg.fillStyle = '#9fe8b5'; cellCg.fillText('1T1C 单元', 64, 42);
  const cellSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cellCv), transparent: true, depthWrite: false }));
  cellSp.scale.set(0.62, 0.31, 1);
  cellSp.position.set(W / 2 + 0.12, 0.34, D / 2 + 0.12);
  cellMark.add(cellBase, cellTop, cellSp);
  g.add(cellMark);

  // 动画状态机:idle → row → col → hit → hold
  let sel = null; // { row, col, phase, t }
  const baseColor = new THREE.Color(0x2a3340);
  const hitColor = new THREE.Color(0x51ff9d);

  const cellCenter = (r, c) => new THREE.Vector3(
    (c - (RAM_COLS - 1) / 2) * 0.016, 0.075, (r - (RAM_ROWS - 1) / 2) * 0.016);

  function select(row, col) {
    if (sel && sel.holdMeshIndex !== undefined) {
      // 恢复上一个命中的单元
      cells.setColorAt(sel.holdMeshIndex, baseColor);
      cells.instanceColor.needsUpdate = true;
    }
    sel = { row, col, phase: 'row', t: 0, holdMeshIndex: row * RAM_COLS + col };
  }

  g.userData.tick = (dt) => {
    if (!sel) return;
    sel.t += dt;
    const cc = cellCenter(sel.row, sel.col);
    if (sel.phase === 'row') {
      // 行选通:亮条从左译码器沿目标行生长
      const k = Math.min(sel.t / 0.4, 1);
      const e = LX.Ease.outCubic(k);
      rowBar.position.set(-W / 2 + (cc.x + W / 2) * e * 0.5, 0.09, cc.z);
      rowBar.scale.x = Math.max((cc.x + W / 2) * e, 0.001);
      rowBar.material.opacity = 0.9;
      if (k >= 1) { sel.phase = 'col'; sel.t = 0; }
    } else if (sel.phase === 'col') {
      // 列选通:亮条从上译码器沿目标列生长到交叉点
      const k = Math.min(sel.t / 0.4, 1);
      const e = LX.Ease.outCubic(k);
      colBar.position.set(cc.x, 0.09, -D / 2 + (cc.z + D / 2) * e * 0.5);
      colBar.scale.z = Math.max((cc.z + D / 2) * e, 0.001);
      colBar.material.opacity = 0.9;
      if (k >= 1) {
        sel.phase = 'hit'; sel.t = 0;
        // 精确命中:仅交叉点单元格高亮
        cells.setColorAt(sel.holdMeshIndex, hitColor);
        cells.instanceColor.needsUpdate = true;
        hitPin.position.set(cc.x, 0.16, cc.z);
      }
    } else if (sel.phase === 'hit') {
      rowBar.material.opacity *= (1 - Math.min(dt * 4, 1));
      colBar.material.opacity *= (1 - Math.min(dt * 4, 1));
      hitPin.material.opacity = 0.6 + Math.sin(sel.t * 6) * 0.35;
      hitPin.position.y = 0.16 + Math.sin(sel.t * 6) * 0.015;
    }
  };

  g.userData.api = {
    select,
    random() {
      select(Math.floor(Math.random() * RAM_ROWS), Math.floor(Math.random() * RAM_COLS));
    },
    status() {
      if (!sel) return '输入行/列地址,或点击随机';
      const bin = (v, bits) => v.toString(2).padStart(bits, '0');
      return `行 ${sel.row}(${bin(sel.row, 8)}) · 列 ${sel.col}(${bin(sel.col, 8)}) — 交叉点单元格已选通`;
    },
  };
  return g;
};

/* ---------- 层 3:存储单元内部(1T1C) ---------- */
LX.models.ram.cell = function () {
  const g = new THREE.Group();
  const mats = {
    capGlass: new THREE.MeshPhysicalMaterial({
      color: 0x9fd8e8, transparent: true, opacity: 0.28, roughness: 0.05,
      clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0,
    }),
    liquid: MRM.mat(0x2fd48a, { emissive: 0x1f8f56, emissiveIntensity: 0.9, transparent: true, opacity: 0.92, roughness: 0.25 }),
    transistor: MRM.mat(0x3a3f47, { metalness: 0.5, roughness: 0.4 }),
    gate: M3RM().gateCol,
    wire: MRM.mat(0x8a8f98, { metalness: 0.8, roughness: 0.35 }),
  };

  // 电容(半透明外壳 + 内部"填充液体")
  const capH = 0.62;
  const capShell = LX.geo.rbox(0.5, capH, 0.5, mats.capGlass, 0.03, 3);
  capShell.position.y = 0.5;
  const liquid = LX.geo.cyl(0.2, 1, mats.liquid, 20);
  liquid.scale.set(1, capH * 0.92, 1);
  liquid.position.y = 0.2; // scale 后实际高度 = level * capH*0.92,自底部生长
  liquid.geometry.translate(0, 0.5, 0); // 圆柱轴心移到底部,便于自底向上填充
  liquid.position.y = 0.2;
  const capRim = LX.geo.rbox(0.54, 0.03, 0.54, MRM.mat(0x3a3f47, { metalness: 0.6, roughness: 0.4 }), 0.008, 1);
  capRim.position.y = capH + 0.215;
  g.add(capShell, liquid, capRim);

  // 晶体管(源/漏/栅)
  const src = LX.geo.rbox(0.22, 0.05, 0.14, mats.transistor, 0.006, 1);
  src.position.set(-0.45, 0.28, 0);
  const drain = src.clone();
  drain.position.x = 0.45;
  const channel = LX.geo.rbox(0.3, 0.035, 0.12, MRM.mat(0x1b1d22, { metalness: 0.3, roughness: 0.5 }), 0.004, 1);
  channel.position.set(0, 0.27, 0);
  const gate = LX.geo.rbox(0.26, 0.05, 0.16, mats.gate, 0.006, 1);
  gate.position.set(0, 0.33, 0);
  g.add(src, drain, channel, gate);

  // 字线(WL,接栅)/ 位线(BL,接源)标牌 + 连线
  const wireTo = (from, to, mat) => {
    const len = from.distanceTo(to);
    const w = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.02), mat);
    w.position.copy(from).add(to).multiplyScalar(0.5);
    w.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x);
    return w;
  };
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  g.add(wireTo(v3(-0.45, 0.28, 0), v3(-1.0, 0.28, 0), mats.wire));
  g.add(wireTo(v3(0.45, 0.28, 0), v3(1.0, 0.28, 0), mats.wire));
  g.add(wireTo(v3(0, 0.33, 0), v3(0, 0.33, -0.9), mats.wire));
  const wlLab = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const cg = c.getContext('2d');
    cg.font = 'bold 34px monospace'; cg.textAlign = 'center';
    cg.fillStyle = '#ffd75e'; cg.fillText('WL 字线', 64, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sp.scale.set(0.5, 0.25, 1); sp.position.set(0, 0.5, -0.95);
    return sp;
  })();
  const blLab = wlLab.clone();
  blLab.material = wlLab.material.clone();
  const blCv = document.createElement('canvas');
  blCv.width = 128; blCv.height = 64;
  const bg = blCv.getContext('2d');
  bg.font = 'bold 34px monospace'; bg.textAlign = 'center';
  bg.fillStyle = '#4cc2ff'; bg.fillText('BL 位线', 64, 42);
  blLab.material.map = new THREE.CanvasTexture(blCv);
  blLab.material.map.encoding = THREE.sRGBEncoding;
  blLab.material.needsUpdate = true;
  blLab.position.set(1.05, 0.45, 0);
  g.add(wlLab, blLab);

  // 状态:液位 0..1(DRAM 漏电)
  let level = 0.72; // 初始:已充电(存 1)
  const statusEl = () => document.getElementById('cell-status');

  g.userData.tick = (dt, t) => {
    level = Math.max(level - dt * 0.012, 0.04); // DRAM 缓慢漏电
    liquid.scale.y = capH * 0.92 * level;
    liquid.position.y = 0.2;
    liquid.material.emissiveIntensity = 0.4 + level * 1.2;
    const el = statusEl();
    if (el) {
      const charged = level > 0.5;
      el.textContent = `电荷 ${Math.round(level * 100)}% · 存储值 ${charged ? '1' : '0'}${level < 0.35 ? ' ⚠ 电荷不足,需要刷新!' : ''}`;
      el.style.color = level < 0.35 ? '#ffc14d' : '#9fe8b5';
    }
  };

  g.userData.api = {
    charge() { level = 1.0; },
    discharge() { level = 0.04; },
    refresh() { level = Math.max(level, 0.95); },
  };
  return g;
};

function M3RM() {
  return { gateCol: MRM.mat(0x4cc2ff, { metalness: 0.4, roughness: 0.4, emissive: 0x1a4a66, emissiveIntensity: 0.4 }) };
}
