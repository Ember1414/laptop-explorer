/* ============================================================
 * models/cpu/pipeline.js — 指令流水线(IF/ID/EX/WB)
 * 四个透明发光隧道区域 + 数据胶囊流过;所在阶段隧道整体高亮,
 * emissive/透明度随数据流入流出平滑过渡(占用度 lerp)。
 * 内置玩具指令执行器:胶囊 = 一条指令,跨越 WB 段时写回寄存器;
 * 运行/单步时挂跟随镜头(由 sceneManager 的 LX.follow 驱动)。
 * 对外契约:group.userData.api = { run, step, reset, load }
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.pipeline = {};

const STAGES = [
  { key: 'IF', name: '取指', color: 0x4cc2ff, x: -1.5 },
  { key: 'ID', name: '译码', color: 0xffd75e, x: -0.5 },
  { key: 'EX', name: '执行', color: 0xff9a4d, x: 0.5 },
  { key: 'WB', name: '写回', color: 0x51e88c, x: 1.5 },
];

// 文字标签 Sprite
function makeLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 44px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 128, 58);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.9, 0.34, 1);
  return sp;
}

LX.models.pipeline.build = function () {
  const M = LX.materials;
  const g = new THREE.Group();

  // 裸片底板(放大后的芯片内部)
  const slab = LX.geo.rbox(4.6, 0.08, 1.7, MCP2().dieSlab, 0.02, 2);
  slab.position.y = 0.04;
  g.add(slab);

  // 四段隧道:半透明壳 + 发光边框 + 标签
  const tunnels = [];
  for (const st of STAGES) {
    const shellMat = new THREE.MeshBasicMaterial({
      color: st.color, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.62, 1.15), shellMat);
    shell.position.set(st.x, 0.45, 0);
    const frameMat = new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.5 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.62, 1.15), frameMat);
    frame.material.wireframe = true;
    frame.position.copy(shell.position);
    const label = makeLabel(st.key + ' ' + st.name, '#' + st.color.toString(16).padStart(6, '0'));
    label.position.set(st.x, 0.95, 0);
    // 每段一个组;EX(执行)段 = ALU 子节点入口
    const holder = new THREE.Group();
    holder.add(shell, frame);
    if (st.key === 'EX') holder.name = 'alu';
    g.add(holder, label);
    tunnels.push({ st, shellMat, frameMat, occ: 0 });
  }

  // 寄存器堆小方块(右端 WB 的落点,数据写回的目标示意)= 寄存器组子节点入口
  const regBank = LX.geo.rbox(0.34, 0.16, 0.9, MCP2().regBank, 0.02, 1);
  regBank.position.set(2.15, 0.16, 0);
  regBank.name = 'registers';
  g.add(regBank);

  // L3 缓存块('cache' 子节点入口:命中/未命中演示)
  const cacheBlk = LX.geo.rbox(0.72, 0.1, 0.24, MCP2().regBank, 0.012, 1);
  cacheBlk.position.set(-0.5, 0.13, 0.72);
  const cacheLab = makeLabel('L3 缓存', '#9fe8b5');
  cacheLab.scale.set(0.66, 0.25, 1);
  cacheLab.position.set(-0.5, 0.4, 0.72);
  const cacheGrp = new THREE.Group();
  cacheGrp.name = 'cache';
  cacheGrp.add(cacheBlk, cacheLab);
  g.add(cacheGrp);

  // ----- 指令胶囊执行器 -----
  const regFile = { A: 0, B: 0, D: 0 };
  const cubes = [];          // { mesh, x, instr, applied }
  const cubeGeo = typeof THREE.CapsuleGeometry === 'function'
    ? new THREE.CapsuleGeometry(0.055, 0.06, 4, 10)
    : new THREE.SphereGeometry(0.07, 12, 12);
  const mkCube = (color) => {
    const mesh = new THREE.Mesh(cubeGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.6, roughness: 0.3 }));
    mesh.position.set(-2.3, 0.45, 0);
    return mesh;
  };

  let program = [];
  let pc = 0;             // 程序计数(待 spawn 的下一条)
  let mode = 'idle';      // idle | run | step
  let status = '就绪 — 输入程序后运行';

  function applyWB(instr) {
    const r = regFile;
    switch (instr.op) {
      case 'MOV': r[instr.d] = instr.imm | 0; break;
      case 'ADD': r[instr.d] = (r[instr.d] + (instr.sreg !== undefined ? r[instr.sreg] : instr.imm | 0)) & 0xff; break;
      case 'SUB': r[instr.d] = (r[instr.d] - (instr.sreg !== undefined ? r[instr.sreg] : instr.imm | 0)) & 0xff; break;
      case 'OUT': status = `OUT ${instr.d} = ${r[instr.d]} (0x${r[instr.d].toString(16)})`; return;
    }
    status = `${instr.op} ${instr.d}${instr.imm !== undefined ? ', ' + instr.imm : instr.sreg !== undefined ? ', ' + instr.sreg : ''} → ${instr.d}=${r[instr.d]}`;
  }

  function spawn() {
    if (pc >= program.length) { mode = cubes.length ? 'drain' : 'idle'; return; }
    const instr = program[pc++];
    const mesh = mkCube(STAGES[0].color);
    g.add(mesh);
    cubes.push({ mesh, x: -2.3, instr, applied: false });
  }

  const tmp = new THREE.Vector3();
  g.userData.tick = (dt, t) => {
    // 胶囊推进(WB 段之后写回并回收)
    for (let i = cubes.length - 1; i >= 0; i--) {
      const cu = cubes[i];
      cu.x += dt * 0.85;
      cu.mesh.position.x = cu.x;
      if (cu.x >= 1.5 && !cu.applied) { cu.applied = true; applyWB(cu.instr); }
      if (cu.x > 2.5) {
        // 被跟随的胶囊回收时,转到下一个活跃胶囊或解除跟随
        if (window.__mgr && window.__mgr.followObj === cu.mesh) {
          const rest = cubes.filter(c => c !== cu);
          if (rest.length) LX.follow.set(rest.reduce((a, b) => (a.x > b.x ? a : b)).mesh);
          else LX.follow.clear();
        }
        g.remove(cu.mesh);
        cubes.splice(i, 1);
      }
    }
    // 流水线灌装:当前最靠前的胶囊进入 ID 段即发射下一条(流水重叠)
    if ((mode === 'run') && pc < program.length) {
      const lead = cubes.length ? Math.max(...cubes.map(c => c.x)) : 99;
      if (!cubes.length || lead >= -1.9) spawn();
    }
    if (mode === 'drain' && !cubes.length) { mode = 'idle'; LX.follow.clear(); status = '执行完毕 — ' + status; }

    // 阶段占用度:胶囊在段内 → 占用目标 1,平滑过渡
    for (const tn of tunnels) {
      let target = 0;
      for (const cu of cubes) {
        const d = Math.abs(cu.x - tn.st.x);
        target = Math.max(target, Math.max(0, 1 - d / 0.5));
      }
      tn.occ += (target - tn.occ) * Math.min(dt * 5, 1);
      tn.shellMat.opacity = 0.035 + tn.occ * 0.1;
      tn.frameMat.opacity = 0.3 + tn.occ * 0.55;
    }
    // 数据胶囊按所在阶段变色(教学:一眼看出指令推进到哪一段)
    for (const cu of cubes) {
      let si = 0;
      for (let i = 0; i < STAGES.length; i++) if (cu.x >= STAGES[i].x - 0.5) si = i;
      cu.mesh.material.emissive.setHex(STAGES[si].color);
      cu.mesh.material.color.setHex(0xdfe9f2);
    }
    // 状态栏
    const el = document.getElementById('asm-status');
    if (el) {
      el.textContent = `A=${regFile.A} B=${regFile.B} D=${regFile.D} · ${status}`;
    }
    // 标签微浮动
    g.children.forEach((o) => { if (o.isSprite) o.position.y = 0.95 + Math.sin(t * 1.5 + o.position.x) * 0.02; });
  };

  // 对外 API(汇编模拟器 UI 调用)
  g.userData.api = {
    loaded: false,
    load(prog) { program = prog; pc = 0; mode = 'idle'; this.loaded = true; status = `已载入 ${prog.length} 条指令`; },
    run() {
      if (!program.length) return;
      mode = 'run';
      if (!cubes.length) { pc = 0; spawn(); }
      if (cubes.length) LX.follow.set(cubes.reduce((a, b) => (a.x > b.x ? a : b)).mesh);
      status = '运行中(跟随镜头)';
    },
    step() {
      if (!program.length) return;
      mode = 'step';
      if (!cubes.length) spawn();
      LX.follow.set(cubes.length ? cubes.reduce((a, b) => (a.x > b.x ? a : b)).mesh : null);
      status = '单步执行';
    },
    reset() {
      for (const cu of cubes) g.remove(cu.mesh);
      cubes.length = 0; pc = 0; mode = 'idle';
      regFile.A = regFile.B = regFile.D = 0;
      LX.follow.clear();
      status = '已重置';
    },
  };

  return g;
};

function MCP2() {
  if (!LX.models.pipeline._m) {
    const M = LX.materials;
    LX.models.pipeline._m = {
      dieSlab: M.mat(0xffffff, {
        map: LX.models.cpu.dieTexture(), metalness: 0.35, roughness: 0.3,
        emissive: 0x0a1420, emissiveIntensity: 0.5,
      }),
      regBank: M.mat(0x232b38, { metalness: 0.6, roughness: 0.35 }),
    };
  }
  return LX.models.pipeline._m;
}
