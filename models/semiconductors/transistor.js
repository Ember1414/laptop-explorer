/* ============================================================
 * models/semiconductors/transistor.js — PN 结与双极性晶体管原理
 * P 区(空穴,红色发光环)/ N 区(电子,蓝色发光小球)/
 * 耗尽层(半透明色带,宽度随外加电压变化):
 *   正偏(V>0):耗尽层变窄,电子与空穴相向扩散,相遇即复合(闪光消失)
 *   反偏(V<0):耗尽层变宽,载流子被"拉回"各自区域,几乎无复合
 * UI:data-node="transistor"(电压滑块 -5V..+0.8V + 自动演示)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.transistor = {};

const MTR = LX.materials;

function tLabel(text, color, scale) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 80;
  const g = c.getContext('2d');
  g.font = 'bold 36px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 160, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale || 1.0, (scale || 1.0) * 0.25, 1);
  return sp;
}

LX.models.transistor.build = function () {
  const g = new THREE.Group();

  // 基板(加深,给角落的电子管对照展台留位)
  const sub = LX.geo.rbox(2.4, 0.06, 1.5, MTR.pcb(), 0.014, 2);
  sub.position.y = 0.03;
  g.add(sub);

  // P 区 / N 区(半透明掺杂半导体)
  const pBlock = LX.geo.rbox(0.95, 0.5, 0.95,
    MTR.mat(0x7a4a4a, { metalness: 0.1, roughness: 0.5, transparent: true, opacity: 0.55 }), 0.01, 1);
  pBlock.position.set(-0.55, 0.31, 0);
  const nBlock = LX.geo.rbox(0.95, 0.5, 0.95,
    MTR.mat(0x4a5a7a, { metalness: 0.1, roughness: 0.5, transparent: true, opacity: 0.55 }), 0.01, 1);
  nBlock.position.set(0.55, 0.31, 0);
  g.add(pBlock, nBlock);

  // 耗尽层(宽度随电压变化,scale.x 控制)
  const dep = LX.geo.rbox(1, 0.54, 1.0,
    new THREE.MeshStandardMaterial({
      color: 0xc8b060, transparent: true, opacity: 0.30, roughness: 0.3,
      emissive: 0x66501c, emissiveIntensity: 0.35,
    }), 0, 1);
  dep.position.set(0, 0.31, 0);
  g.add(dep);

  // 电极
  const anode = LX.geo.rbox(0.06, 0.16, 0.3, MTR.mat(0xc9a227, { metalness: 0.9, roughness: 0.3 }), 0, 1);
  anode.position.set(-1.06, 0.35, 0);
  const cathode = anode.clone();
  cathode.position.x = 1.06;
  g.add(anode, cathode);

  // 对照展台:微型电子管('vacuumtube' 子节点入口,真实几何替代发光球)
  const vtBase = LX.geo.rbox(0.3, 0.03, 0.24, MTR.mat(0x23272e, { metalness: 0.5, roughness: 0.45 }), 0.008, 1);
  vtBase.position.set(0.95, 0.045, 0.6);
  const vtGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbfd8e8, transparent: true, opacity: 0.22, roughness: 0.05,
    clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0, side: THREE.DoubleSide,
  });
  const vtGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.3, 18, 1, true), vtGlassMat);
  vtGlass.position.set(0.95, 0.21, 0.6);
  const vtDome = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), vtGlassMat);
  vtDome.position.set(0.95, 0.36, 0.6);
  const vtPlate = LX.geo.cyl(0.05, 0.1, MTR.mat(0x565d68, { metalness: 0.8, roughness: 0.3 }), 14);
  vtPlate.position.set(0.95, 0.13, 0.6);
  const vtFil = LX.geo.cyl(0.008, 0.2, MTR.mat(0xc9a06a, { metalness: 0.7, roughness: 0.3, emissive: 0xff8030, emissiveIntensity: 1.2 }), 8);
  vtFil.position.set(0.95, 0.16, 0.6);
  const vtLab = tLabel('对照 · 电子管', '#8fd4ff', 0.62);
  vtLab.position.set(0.95, 0.54, 0.6);
  const vtGrp = new THREE.Group();
  vtGrp.name = 'vacuumtube';
  vtGrp.add(vtBase, vtGlass, vtDome, vtPlate, vtFil, vtLab);
  g.add(vtGrp);

  // 标签
  const lP = tLabel('P 区(空穴)', '#ff9a9a', 0.9); lP.position.set(-0.62, 0.72, 0);
  const lN = tLabel('N 区(电子)', '#9ab8ff', 0.9); lN.position.set(0.62, 0.72, 0);
  const lDep = tLabel('耗尽层', '#ffe08a', 0.7); lDep.position.set(0, 0.74, 0);
  g.add(lP, lN, lDep);

  /* ----- 载流子 ----- */
  const NE = 14, NH = 12;
  const eMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x4fa8ff, emissiveIntensity: 2.0, roughness: 0.3 });
  const hMat = new THREE.MeshStandardMaterial({ color: 0xff6a6a, emissive: 0xff3030, emissiveIntensity: 1.6, roughness: 0.35 });
  const eMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 10), eMat, NE);
  const hMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.045, 0.016, 8, 16), hMat, NH);
  hMesh.rotation.x = Math.PI / 2; // 空穴环面向上(展示"空位"感)
  g.add(eMesh, hMesh);
  const rnd = LX.textures.random(64);
  const electrons = [], holes = [];
  for (let i = 0; i < NE; i++)
    electrons.push({ x: 0.15 + rnd() * 0.75, z: (rnd() - 0.5) * 0.7, ph: rnd() });
  for (let i = 0; i < NH; i++)
    holes.push({ x: -0.15 - rnd() * 0.75, z: (rnd() - 0.5) * 0.7, ph: rnd() });

  // 复合闪光池
  const flashes = [];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, depthWrite: false }));
    g.add(f);
    flashes.push({ mesh: f, t: 1 });
  }

  /* ----- 状态 ----- */
  let V = 0.6;          // 外加电压:-5(反偏)..0.8(正偏)
  let auto = true, autoT = 0;
  const depletionW = () => Math.min(Math.max(0.34 - 0.26 * V, 0.12), 1.25);
  const driftSpeed = () => V > 0 ? 0.16 + V * 0.22 : 0;

  const d4 = new THREE.Object3D();

  g.userData.tick = (dt, t) => {
    // 自动演示:正偏/零偏/反偏 轮播
    if (auto) {
      autoT += dt;
      if (autoT > 6) { autoT = 0; V = V > 0 ? (Math.random() < 0.3 ? 0 : -4) : 0.65; }
    }
    const w = depletionW();
    dep.scale.x = w;
    const edgeL = -w / 2, edgeR = w / 2;
    const spd = driftSpeed();

    // 电子:N 区 → 正偏时向左扩散进耗尽层
    for (let i = 0; i < NE; i++) {
      const e = electrons[i];
      if (V > 0) {
        e.x -= spd * dt * (0.6 + 0.4 * Math.sin(t * 3 + e.ph * 6));
        if (e.x < edgeR * 0.5 && e.x > edgeL * 1.4) {
          // 在耗尽层内寻找空穴复合
          for (const h of holes) {
            const dx = Math.abs(h.x - e.x), dz = Math.abs(h.z - e.z);
            if (dx < 0.1 && dz < 0.12) {
              // 复合:闪光消失
              const f = flashes.find(ff => ff.t >= 1);
              if (f) { f.mesh.position.set((e.x + h.x) / 2, 0.36, (e.z + h.z) / 2); f.t = 0; }
              e.x = 0.2 + Math.random() * 0.7;  // 重生回 N 区
              h.x = -0.2 - Math.random() * 0.7; // 空穴重生回 P 区
              break;
            }
          }
        }
        if (e.x < -0.95) e.x = 0.2 + Math.random() * 0.7; // 越过 P 区边界(持续正偏)
      } else {
        // 反偏:被拉回 N 区深处
        e.x += Math.min(Math.abs(V) * 0.06, 0.3) * dt * 2;
        if (e.x > 0.9) e.x = 0.2 + Math.random() * 0.6;
      }
      e.x = Math.min(Math.max(e.x, -0.92), 0.92);
      d4.position.set(e.x, 0.36 + Math.sin(t * 2.5 + e.ph * 6) * 0.03, e.z);
      d4.updateMatrix();
      eMesh.setMatrixAt(i, d4.matrix);
    }
    // 空穴:P 区 → 正偏时向右扩散
    for (let i = 0; i < NH; i++) {
      const h = holes[i];
      if (V > 0) {
        h.x += spd * dt * (0.6 + 0.4 * Math.sin(t * 2.6 + h.ph * 6));
        if (h.x > -0.95) h.x = Math.min(h.x, -0.15);
        if (h.x > 0.85) h.x = -0.2 - Math.random() * 0.7;
      } else {
        h.x -= Math.min(Math.abs(V) * 0.06, 0.3) * dt * 2;
        if (h.x < -0.9) h.x = -0.2 - Math.random() * 0.6;
      }
      h.x = Math.min(Math.max(h.x, -0.92), 0.92);
      d4.position.set(h.x, 0.36 + Math.sin(t * 2 + h.ph * 6) * 0.03, h.z);
      d4.updateMatrix();
      hMesh.setMatrixAt(i, d4.matrix);
    }
    eMesh.instanceMatrix.needsUpdate = true;
    hMesh.instanceMatrix.needsUpdate = true;

    // 复合闪光衰减
    for (const f of flashes) {
      if (f.t < 1) {
        f.t += dt * 2.4;
        f.mesh.material.opacity = Math.max(0, 1 - f.t) * 0.9;
        f.mesh.scale.setScalar(1 + f.t * 2.2);
      }
    }

    // 耗尽层标签跟随宽度
    const el = document.getElementById('pn-status');
    if (el) {
      el.textContent = V > 0.05
        ? `正偏 ${V.toFixed(1)}V:耗尽层变窄(${w.toFixed(2)}),载流子跨过结区复合 — 电流导通`
        : V < -0.05
          ? `反偏 ${V.toFixed(1)}V:耗尽层变宽(${w.toFixed(2)}),载流子被拉回 — 几乎不导通`
          : `零偏:扩散与漂移达到平衡,耗尽层宽度 ${w.toFixed(2)}`;
    }
  };

  g.userData.api = {
    setV(v) { V = Math.min(Math.max(v, -5), 0.8); auto = false; autoT = 0; },
    resumeAuto() { auto = true; },
    get V() { return V; },
  };
  return g;
};
