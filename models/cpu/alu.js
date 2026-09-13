/* ============================================================
 * models/cpu/alu.js — ALU 内部:全加器
 * 用标准电路图符号的 3D 化(AND: D 形;OR: 弧背尖头;XOR: OR+背弧线)
 * 搭出一个全加器:A⊕B⊕Cin = Sum,AB+Cin(A⊕B) = Cout。
 * 信号线按网络着色:数据 1 = 绿色高亮;进位 Cout 传播路径 = 红色高亮。
 * 输入可由 UI 面板手动切换,也自动循环真值表演示。
 * 覆盖 UI:data-node="alu"(见 index.html #alu-panel)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.alu = {};

const MAL = LX.materials;

/* ---------- 门符号(挤出 3D 化的标准电路符号) ---------- */

// AND:D 形(平输入边 + 半圆输出边)
function andShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w, -h / 2);
  s.lineTo(0, -h / 2);
  s.absarc(0, 0, h / 2, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-w, h / 2);
  s.closePath();
  return s;
}
// OR:弧背 + 尖头
function orShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w, -h / 2);
  s.quadraticCurveTo(-w * 0.35, 0, -w, h / 2);
  s.quadraticCurveTo(w * 0.35, h * 0.40, w, 0);
  s.quadraticCurveTo(w * 0.35, -h * 0.40, -w, -h / 2);
  s.closePath();
  return s;
}
const GATE_TINT = { AND: 0x4a6fa5, OR: 0xa5544a, XOR: 0x6b5aa5 };
function gateMesh(kind, mats, w = 0.3, h = 0.22) {
  let geo;
  if (kind === 'AND') geo = LX.geo.extrudeWithHoles(andShape(w, h), { depth: 0.05 });
  else geo = LX.geo.extrudeWithHoles(orShape(w, h), { depth: 0.05 });
  geo.rotateY(-Math.PI / 2); // 立起来:面朝 +x(信号流向)
  const body = new THREE.Mesh(geo, mats.gateBody.clone());
  body.material.color.setHex(GATE_TINT[kind] || 0x3a3f47);
  body.position.y = 0.09;
  const grp = new THREE.Group();
  grp.add(body);
  if (kind === 'XOR') { // XOR:输入侧额外一条弧线
    const arc = new THREE.Mesh(new THREE.TorusGeometry(h / 2, 0.008, 6, 20, Math.PI), mats.gateBody);
    arc.rotation.z = Math.PI / 2;
    arc.rotation.y = Math.PI / 2;
    arc.position.set(-w - 0.028 + 0.05, 0.09, 0);
    grp.add(arc);
  }
  grp.userData.gateBody = body;
  return grp;
}
function labelSprite(text, color = '#8fd4ff') {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 64, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.32, 0.16, 1);
  return sp;
}

LX.models.alu.build = function () {
  const mats = {
    gateBody: M_AL_gate(),
    pad: MAL.mat(0xc9a227, { metalness: 0.9, roughness: 0.3 }),
  };
  const g = new THREE.Group();

  // 基板
  const sub = LX.geo.rbox(2.1, 0.05, 1.15, MAL.pcb(), 0.015, 2);
  sub.position.y = 0.025;
  g.add(sub);

  // 门:XOR1(A,B) / AND1(A,B) / XOR2(X1,Cin)=Sum / AND2(X1,Cin) / OR(N1,N2)=Cout
  const gateDefs = [
    ['XOR', 'XOR1', -0.55, 0.18], ['AND', 'AND1', -0.55, -0.22],
    ['XOR', 'XOR2', 0.1, 0.18], ['AND', 'AND2', 0.1, -0.22],
    ['OR', 'OR', 0.62, -0.02],
  ];
  const gates = {};
  for (const [kind, name, x, z] of gateDefs) {
    const gt = gateMesh(kind, mats);
    gt.position.set(x, 0, z);
    const lab = labelSprite(name, '#9fb6cc');
    lab.position.set(x, 0.34, z);
    gt.add(lab);
    if (name === 'XOR1') gt.name = 'transistor'; // 门由晶体管搭成 → 晶体管子节点入口
    gates[name] = gt;
    g.add(gt);
  }

  // 输入/输出焊盘
  const pads = {};
  for (const [name, x, z] of [['A', -0.85, 0.28], ['B', -0.85, 0.06], ['Cin', -0.85, -0.3], ['SUM', 0.95, 0.24], ['COUT', 0.95, -0.16]]) {
    const pad = LX.geo.cyl(0.03, 0.02, mats.pad, 14);
    pad.position.set(x, 0.05, z);
    const lab = labelSprite(name, name === 'COUT' ? '#ff8080' : '#ffe066');
    lab.position.set(x, 0.18, z);
    pads[name] = pad;
    g.add(pad, lab);
  }

  /* ----- 信号线:L 形布线段,按网络分组(材质 per-net,便于整体调光) ----- */
  const wireSegs = (pts, thin = 0.014) => {
    const arr = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1e-4) continue;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len, thin, thin), null);
      seg.material = null; // 材质由网络统一赋值
      seg.position.set((x0 + x1) / 2, 0.075, (z0 + z1) / 2);
      seg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      arr.push(seg);
    }
    return arr;
  };
  // 布线点(直角走线)
  const routes = {
    A: [[-0.85, 0.28], [-0.7, 0.28], [-0.7, 0.26], [-0.66, 0.26]],
    B: [[-0.85, 0.06], [-0.7, 0.06], [-0.7, 0.1], [-0.66, 0.1]],
    Cin: [[-0.85, -0.3], [-0.74, -0.3], [-0.74, -0.42], [-0.08, -0.42], [-0.08, -0.16]],
    X1_to_XOR2: [[-0.46, 0.18], [-0.01, 0.18]],
    X1_to_AND2: [[-0.46, 0.18], [-0.3, 0.18], [-0.3, -0.18], [-0.01, -0.18]],
    N1_to_OR: [[-0.4, -0.22], [0.3, -0.22], [0.3, -0.14], [0.52, -0.14]],
    N2_to_OR: [[0.21, -0.22], [0.4, -0.22], [0.4, -0.1], [0.52, -0.1]],
    SUM: [[0.22, 0.18], [0.8, 0.18], [0.8, 0.24], [0.95, 0.24]],
    COUT: [[0.75, -0.02], [0.82, -0.02], [0.82, -0.16], [0.95, -0.16]],
  };
  const nets = {}; // name → { meshes, value }
  for (const name in routes) {
    const netMat = name === 'COUT'
      ? MAL.mat(0x55191c, { metalness: 0.4, roughness: 0.4, emissive: 0xff4040, emissiveIntensity: 0.05 })
      : MAL.mat(0x1c332b, { metalness: 0.4, roughness: 0.4, emissive: 0x44ff88, emissiveIntensity: 0.05 });
    const segs = wireSegs(routes[name]);
    segs.forEach(sg => { sg.material = netMat; g.add(sg); });
    nets[name] = { meshes: segs, mat: netMat, value: 0 };
  }

  /* ----- 真值表自动演示 + 手动覆盖 ----- */
  const state = { A: 0, B: 0, Cin: 0, autoT: -10 };
  const truthTable = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  let idx = 0;
  let lastManual = -10;

  g.userData.tick = (dt, t) => {
    // 自动循环(手动切换后暂停 8s)
    if (t - state.autoT > 1.7 && t - lastManual > 8) {
      [state.A, state.B, state.Cin] = truthTable[idx++ % truthTable.length];
      state.autoT = t;
    }
    // 全加器逻辑
    const X1 = state.A ^ state.B;
    const N1 = state.A & state.B;
    const SUM = X1 ^ state.Cin;
    const N2 = X1 & state.Cin;
    const COUT = N1 | N2;
    nets.A.value = state.A; nets.B.value = state.B; nets.Cin.value = state.Cin;
    nets.X1_to_XOR2.value = X1; nets.X1_to_AND2.value = X1;
    nets.N1_to_OR.value = N1; nets.N2_to_OR.value = N2;
    nets.SUM.value = SUM; nets.COUT.value = COUT;

    // 信号线亮度:值=1 绿色亮起;COUT=1 红色高亮传播
    for (const name in nets) {
      const n = nets[name];
      const target = n.value ? (name === 'COUT' ? 3.0 : 2.4) : 0.05;
      n.mat.emissiveIntensity += (target - n.mat.emissiveIntensity) * Math.min(dt * 8, 1);
    }
    // 门体激活发光(输出=1)
    const gateActive = {
      XOR1: X1, AND1: N1, XOR2: SUM, AND2: N2, OR: COUT,
    };
    for (const name in gates) {
      const body = gates[name].userData.gateBody;
      const on = gateActive[name];
      body.material.emissive.setHex(name === 'OR' && COUT ? 0xff4040 : 0x66d9ff);
      body.material.emissiveIntensity += ((on ? 0.85 : 0.06) - body.material.emissiveIntensity) * Math.min(dt * 8, 1);
    }
    // 焊盘为常亮金属,不做状态
    // 状态浮标 + 按钮标签同步
    const el = document.getElementById('alu-status');
    if (el) el.textContent = `A=${state.A} B=${state.B} Cin=${state.Cin} → Sum=${SUM} Cout=${COUT}`;
    const bmap = { A: 'alu-a', B: 'alu-b', Cin: 'alu-cin' };
    for (const k in bmap) {
      const b = document.getElementById(bmap[k]);
      if (b) b.textContent = `${k} = ${state[k]}`;
    }
  };

  // UI 面板手动切换(与 #alu-panel 按钮对接)
  g.userData.api = {
    toggle(input) {
      if (!(input in state)) return state[input];
      state[input] ^= 1;
      lastManual = window.__mgr.modelTime;
      state.autoT = window.__mgr.modelTime;
      return state[input];
    },
  };
  return g;
};

function M_AL_gate() {
  return MAL.mat(0x3a3f47, { metalness: 0.35, roughness: 0.45, roughnessMap: LX.textures.grain(), emissive: 0x66d9ff, emissiveIntensity: 0.06 });
}
