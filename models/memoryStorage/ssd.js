/* ============================================================
 * models/memoryStorage/ssd.js — M.2 固态硬盘
 * build()    物理外观:PCB 长条 + 主控芯片 + 两颗 NAND 颗粒 +
 *            缓存/标签 + 金手指('nand' 命名组 = NAND 子节点入口)
 * buildNand() NAND 内部:两个块(Block A/B),每块 8 页的三维堆叠。
 *   页状态:空(浅灰)/ 有效(绿色)/ 无效(深灰,已标记删除)。
 *   写入:填充当前写入块的下一个空白页(绿色)。
 *   垃圾回收:先把块内有效页"逐页搬运"到备用块(动画:源页闪灰、
 *   目标页点亮绿色),全部迁移完成后再整块擦除(白闪 → 复位浅灰)。
 *   完整展示"先搬有效数据、再擦旧块",不简化成单纯清空。
 * 覆盖 UI:data-node="nand"(写入/垃圾回收按钮)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.ssd = {};

const MSD = LX.materials;

/* ---------- 物理外观 ---------- */
LX.models.ssd.build = function () {
  const g = new THREE.Group();

  const pcb = LX.geo.rbox(0.22, 0.028, 0.8, MSD.pcb(), 0.008, 1); // 真 2280:80mm
  pcb.position.y = 0.014;
  g.add(pcb);

  // 主控芯片(带散热贴片)
  const controller = LX.geo.rbox(0.16, 0.022, 0.16, MSD.chip(), 0.005, 1);
  controller.position.set(0, 0.032, 0.28);
  const ctrlCap = LX.geo.rbox(0.14, 0.008, 0.14, MSD.mat(0x565d68, { metalness: 0.7, roughness: 0.35 }), 0.004, 1);
  ctrlCap.position.set(0, 0.047, 0.28);
  g.add(controller, ctrlCap);

  // 两颗 NAND 颗粒(第一颗 = 'nand' 子节点入口)
  const nand = new THREE.Group();
  nand.name = 'nand';
  for (let i = 0; i < 2; i++) {
    const n = LX.geo.rbox(0.16, 0.02, 0.24, MSD.chip(), 0.005, 1);
    n.position.set(0, 0.03, -0.12 - i * 0.3);
    nand.add(n);
    if (i === 0) {
      const dot = LX.geo.cyl(0.006, 0.002, MSD.mat(0x8a8f98, { roughness: 0.5 }), 8);
      dot.position.set(-0.055, 0.041, -0.18);
      nand.add(dot);
    }
  }
  g.add(nand);

  // NAND 激光印字(两颗颗粒)
  const nlCv = document.createElement('canvas');
  nlCv.width = 128; nlCv.height = 48;
  const nlg = nlCv.getContext('2d');
  nlg.fillStyle = '#232932'; nlg.fillRect(0, 0, 128, 48);
  nlg.fillStyle = '#aebdd0';
  nlg.font = 'bold 16px monospace';
  nlg.fillText('LXNAND', 8, 20);
  nlg.font = '12px monospace';
  nlg.fillText('512GB ONFI', 8, 40);
  const nlTex = new THREE.CanvasTexture(nlCv);
  nlTex.encoding = THREE.sRGBEncoding;
  for (const nz of [-0.12, -0.42]) {
    const nl = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.056),
      new THREE.MeshStandardMaterial({ map: nlTex, roughness: 0.5, metalness: 0.05 }));
    nl.rotation.x = -Math.PI / 2;
    nl.position.set(0, 0.0415, nz);
    g.add(nl);
  }

  // 标签贴纸
  const stickerC = document.createElement('canvas');
  stickerC.width = 256; stickerC.height = 96;
  const sg = stickerC.getContext('2d');
  sg.fillStyle = '#e8eaee';
  sg.fillRect(0, 0, 256, 96);
  sg.fillStyle = '#33383f';
  sg.font = 'bold 26px monospace';
  sg.fillText('EMBER SSD 1TB', 18, 40);
  sg.font = '16px monospace';
  sg.fillText('NVMe PCIe GEN4 · 2280', 18, 70);
  const stickerTex = new THREE.CanvasTexture(stickerC);
  stickerTex.encoding = THREE.sRGBEncoding;
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.075),
    MSD.mat(0xffffff, { map: stickerTex, roughness: 0.5 }));
  sticker.rotation.x = -Math.PI / 2;
  sticker.position.set(0, 0.043, -0.62);
  g.add(sticker);

  // 金手指
  const fingers = LX.geo.rbox(0.2, 0.02, 0.04, MSD.mat(0xc9a227, { metalness: 0.95, roughness: 0.2 }), 0, 1);
  fingers.position.set(0, 0.02, 0.36);
  g.add(fingers);
  // M.2 防呆缺口(M key 错位缺口)+ 主控导热垫
  const notch = LX.geo.rbox(0.014, 0.021, 0.028, MSD.mat(0x101318, { roughness: 0.7 }), 0, 1);
  notch.position.set(-0.06, 0.02, 0.36);
  g.add(notch);
  const tpad = LX.geo.rbox(0.1, 0.004, 0.1, MSD.mat(0x9aa4b2, { metalness: 0.3, roughness: 0.8 }), 0, 1);
  tpad.position.set(0, 0.052, 0.3);
  g.add(tpad);

  // 单颗固定螺丝
  const screw = LX.geo.cyl(0.012, 0.006, MSD.mat(0x9aa2ad, { metalness: 0.9, roughness: 0.3 }), 12);
  screw.position.set(0.08, 0.033, -0.72);
  g.add(screw);

  return g;
};

/* ---------- NAND 内部:页 / 块三维结构 + 垃圾回收 ---------- */
LX.models.ssd.buildNand = function () {
  const g = new THREE.Group();
  const PAGES = 8;

  // 两块:块 A(工作中的)/ 块 B(备用,GC 目标)
  const mkBlock = (label, x) => {
    const grp = new THREE.Group();
    grp.position.set(x, 0, 0);
    const base = LX.geo.rbox(0.66, 0.03, 0.85, M3SD().frame, 0.008, 1);
    base.position.y = 0.015;
    grp.add(base);
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const cg = cv.getContext('2d');
    cg.font = 'bold 34px monospace'; cg.textAlign = 'center';
    cg.fillStyle = '#cfe3ff'; cg.fillText(label, 64, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(0.42, 0.21, 1);
    sp.position.set(0, 0.66, 0);
    grp.add(sp);
    return grp;
  };
  const blockA = mkBlock('块 A(写入中)', -0.4);
  const blockB = mkBlock('块 B(备用)', 0.4);
  g.add(blockA, blockB);

  // 页状态与网格:state: empty | valid | stale
  const pageGeo = new THREE.BoxGeometry(0.52, 0.05, 0.6);
  // 每次赋值新建材质(避免任何共享实例的意外复用)
  const MK = {
    empty: () => MSD.mat(0xb9bec6, { metalness: 0.15, roughness: 0.5 }),
    valid: () => MSD.mat(0x2f8f5a, { metalness: 0.2, roughness: 0.45, emissive: 0x0f4a2c, emissiveIntensity: 0.7 }),
    stale: () => MSD.mat(0x4a4436, { metalness: 0.15, roughness: 0.55 }),
  };
  const stateMats = { empty: MK.empty(), valid: MK.valid(), stale: MK.stale() };
  const oldMats = [];
  const blockPages = { A: [], B: [] };
  g.userData.nandState = { blockPages };
  const mkPages = (blockGrp, arr) => {
    for (let i = 0; i < PAGES; i++) {
      const p = new THREE.Mesh(pageGeo, stateMats.empty.clone());
      p.position.set(0, 0.06 + i * 0.072, 0);
      blockGrp.add(p);
      arr.push({ mesh: p, state: 'empty' });
    }
  };
  mkPages(blockA, blockPages.A);
  mkPages(blockB, blockPages.B);

  // 初始剧情:块 A 已有一些数据(有效/无效混合)
  const seedStates = ['valid', 'valid', 'stale', 'valid', 'stale', 'empty', 'empty', 'empty'];
  seedStates.forEach((st, i) => setPage('A', i, st));

  function setPage(block, i, state) {
    const pg = blockPages[block][i];
    pg.state = state;
    if (pg.material !== stateMats.empty && pg.material !== stateMats.valid && pg.material !== stateMats.stale) {
      oldMats.push(pg.material); // 闪白等临时材质,记录待释放
    }
    // 原位改色:不替换材质对象,直接设置颜色与自发光
    pg.material.color.setHex(state === 'valid' ? 0x2f8f5a : state === 'stale' ? 0x4a4436 : 0xb9bec6);
    pg.material.emissive.setHex(state === 'valid' ? 0x0f4a2c : 0x000000);
    pg.material.emissiveIntensity = state === 'valid' ? 0.7 : 0;
    pg.material.roughness = 0.5;
    pg.material.metalness = 0.2;
  }
  function firstEmpty(block) {
    return blockPages[block].findIndex(p => p.state === 'empty');
  }
  function validCount(block) {
    return blockPages[block].filter(p => p.state === 'valid').length;
  }

  // 写入指针:块 A 的下一个空白页
  let active = 'A';
  let status = '闪存按"页"写入、按"块"擦除——先写入看看';
  const statusEl = () => document.getElementById('nand-status');

  /* ----- 动画步骤队列(垃圾回收的多步流程) ----- */
  let queue = [];   // [{kind:'migrate'|'eraseFlash'|'reset', ...}]
  let current = null;

  function queueGC(from = 'A', to = 'B') {
    queue = [];
    // 1) 有效页逐个搬运
    blockPages[from].forEach((p, i) => {
      if (p.state === 'valid') {
        queue.push({ kind: 'migrate', from, to, i });
      }
    });
    // 2) 旧块擦除:白闪 → 复位
    queue.push({ kind: 'eraseFlash', from });
    queue.push({ kind: 'reset', from });
    // 3) 交换工作块:备用块成为新的写入块
    queue.push({ kind: 'swap', from, to });
  }

  g.userData.tick = (dt) => {
    if (!current && queue.length) {
      current = queue.shift();
      current.t = 0;
      if (current.kind === 'eraseFlash') {
        // 整块白闪:独立覆盖板(不改写页材质,杜绝状态卡死)
        const grp = current.from === 'A' ? blockA : blockB;
        current.overlay = new THREE.Mesh(
          new THREE.BoxGeometry(0.56, PAGES * 0.072 + 0.06, 0.66),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
        current.overlay.position.set(0, 0.05 + (PAGES * 0.072) / 2, 0);
        grp.add(current.overlay);
        status = '有效数据已全部迁出,正在擦除旧块…';
      }
    }
    if (!current) {
      const el = statusEl();
      if (el) el.textContent = status;
      return;
    }
    current.t += dt;
    const k = Math.min(current.t / (current.dur || 0.8), 1);

    if (current.kind === 'migrate') {
      if (k >= 1) {
        // 落位:源页变无效(深灰),备用块对应页变有效(绿色)
        setPage(current.from, current.i, 'stale');
        const dst = firstEmpty(current.to);
        if (dst >= 0) setPage(current.to, dst, 'valid');
        status = `垃圾回收:有效页 ${current.i} 已搬运转存…`;
        current = null;
      }
    } else if (current.kind === 'eraseFlash') {
      // 白闪渐隐(覆盖板)
      current.overlay.material.opacity = 0.9 * (1 - k);
      if (k >= 1) {
        const grp = current.from === 'A' ? blockA : blockB;
        grp.remove(current.overlay);
        current.overlay.geometry.dispose();
        current.overlay.material.dispose();
        blockPages[current.from].forEach((p, i) => setPage(current.from, i, 'empty'));
        status = '旧块已擦除,恢复为空白块(闪存擦除以"块"为单位)';
        current = null;
      }
    } else if (current.kind === 'reset') {
      current = null;
    } else if (current.kind === 'swap') {
      active = active === 'A' ? 'B' : 'A';
      status = active === 'A'
        ? '块 A 已恢复空白,成为新的写入块'
        : '块 B 已恢复空白,成为新的写入块';
      current = null;
    }
    const el = statusEl();
    if (el && current && current.kind === 'migrate') {
      el.textContent = `垃圾回收:正在搬运块 ${current.from} 第 ${current.i} 页…`;
    }
  };

  // 瞬时结算动画队列(写入等操作在 GC 进行中到达时,先快进到稳定态)
  function fastForward() {
    while (queue.length || current) {
      if (!current) current = queue.shift();
      if (current.kind === 'migrate') {
        setPage(current.from, current.i, 'stale');
        const dst = firstEmpty(current.to);
        if (dst >= 0) setPage(current.to, dst, 'valid');
      } else if (current.kind === 'eraseFlash') {
        const grp = current.from === 'A' ? blockA : blockB;
        if (current.overlay) { grp.remove(current.overlay); current.overlay.geometry.dispose(); current.overlay.material.dispose(); }
        blockPages[current.from].forEach((p, i) => setPage(current.from, i, 'empty'));
      } else if (current.kind === 'swap') {
        active = current.from === 'A' ? 'B' : 'A';
      }
      current = null;
    }
  }

  g.userData.api = {
    fastForward,
    write() {
      if (queue.length || current) fastForward();
      const i = firstEmpty(active);
      if (i < 0) { // 块写满 → 自动触发垃圾回收
        status = '写入块已满且含无效页 → 触发垃圾回收';
        queueGC(active, active === 'A' ? 'B' : 'A');
        return;
      }
      setPage(active, i, 'valid');
      status = `写入:块 ${active} 第 ${i} 页已填充(绿色 = 有效数据)`;
    },
    gc() {
      if (queue.length || current) fastForward();
      if (validCount(active) === 0) {
        status = '当前块没有无效页,无需垃圾回收(直接整块擦除也可)';
        queue.push({ kind: 'eraseFlash', from: active });
        queue.push({ kind: 'reset', from: active });
        queue.push({ kind: 'swap', from: active, to: active === 'A' ? 'B' : 'A' });
        return;
      }
      status = '触发垃圾回收…';
      queueGC(active, active === 'A' ? 'B' : 'A');
    },
  };
  return g;
};

function M3SD() {
  // 每次 build 新建(离开节点会被 dispose,不缓存)
  const M = LX.materials;
  return {
    frame: M.mat(0x23272e, { metalness: 0.5, roughness: 0.45 }),
    empty: M.mat(0xb9bec6, { metalness: 0.15, roughness: 0.5 }),
    valid: M.mat(0x2f8f5a, { metalness: 0.2, roughness: 0.45, emissive: 0x0f4a2c, emissiveIntensity: 0.7 }),
    stale: M.mat(0x4a4436, { metalness: 0.15, roughness: 0.55 }),
  };
}
