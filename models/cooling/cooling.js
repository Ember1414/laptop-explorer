/* ============================================================
 * models/cooling/cooling.js — 散热模组
 * 离心风扇(鼓风机)+ 铜热管(CPU/GPU → 鳍片)+ 散热鳍片组。
 * 后续阶段:风道/热管工作原理下钻。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.cooling = {};

LX.models.cooling.build = function () {
  const M = LX.materials;
  const g = new THREE.Group();

  // 离心风扇(鼓风机 Ø4.8cm,落位于主板风扇缺口)
  const blower = LX.geo.cyl(0.24, 0.15, M.mat(0x2b313a, { metalness: 0.5, roughness: 0.45, roughnessMap: LX.textures.grain() }), 28);
  blower.position.set(-0.35, 0.075, -0.25);
  const fanSpin = new THREE.Group();          // 旋转部分(叶片+毂)
  fanSpin.position.set(-0.35, 0.16, -0.25);
  const bladeMat = M.mat(0x4a525e, { metalness: 0.6, roughness: 0.35 });
  // 真机离心叶轮:26 片后掠薄叶片 + 外圈导流环
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.19), bladeMat);
    b.position.set(Math.cos(a) * 0.13, 0.004, Math.sin(a) * 0.13);
    b.rotation.y = -a + 0.62;   // 后掠攻角
    b.rotation.z = 0.2;         // 顶面倾斜(离心受力面)
    fanSpin.add(b);
  }
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.012, 8, 40), bladeMat);
  shroud.rotation.x = Math.PI / 2;
  shroud.position.y = 0.004;
  fanSpin.add(shroud);
  const hub = LX.geo.cyl(0.09, 0.03, M.chip(), 16);
  hub.position.y = 0.015;
  fanSpin.add(hub);
  // 运动模糊盘:径向条纹贴图,随转速淡入(简易模糊)
  const blurCv = document.createElement('canvas');
  blurCv.width = 128; blurCv.height = 128;
  const bg2 = blurCv.getContext('2d');
  bg2.translate(64, 64);
  for (let i = 0; i < 60; i++) {
    const a0 = Math.random() * Math.PI * 2, r0 = 8 + Math.random() * 52;
    bg2.strokeStyle = `rgba(190,205,225,${0.10 + Math.random() * 0.16})`;
    bg2.lineWidth = 1 + Math.random() * 2;
    bg2.beginPath(); bg2.arc(0, 0, r0, a0, a0 + 0.5 + Math.random() * 1.2); bg2.stroke();
  }
  const blurTex = new THREE.CanvasTexture(blurCv);
  const blurDisc = new THREE.Mesh(new THREE.CircleGeometry(0.22, 28),
    new THREE.MeshBasicMaterial({ map: blurTex, transparent: true, opacity: 0, depthWrite: false }));
  blurDisc.rotation.x = -Math.PI / 2;
  blurDisc.position.set(-0.35, 0.175, -0.25);
  const volute = LX.geo.rbox(0.14, 0.16, 0.42, M.mat(0x2b313a, { metalness: 0.5, roughness: 0.45 }), 0.01, 1);
  volute.position.set(-0.35, 0.08, -0.5);

  // 顶部进风格栅(径向栅条)+ 蜗壳减震胶垫
  const intakeRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 8, 40),
    M.mat(0x14171c, { roughness: 0.7 }));
  intakeRing.rotation.x = Math.PI / 2;
  intakeRing.position.set(-0.35, 0.151, -0.25);
  g.add(intakeRing);
  const slotT = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    slotT.push({ p: [-0.35 + Math.cos(a) * 0.14, 0.152, -0.25 + Math.sin(a) * 0.14], r: [0, -a, 0] });
  }
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.04, 0.004, 0.011), M.mat(0x14171c, { roughness: 0.7 }), slotT));
  for (const [gx, gz] of [[-0.53, -0.1], [-0.17, -0.1]]) {
    const grommet = LX.geo.cyl(0.016, 0.02, M.rubber(), 10);
    grommet.position.set(gx, 0.01, gz);
    g.add(grommet);
  }

  // 散热鳍片组:26 片 0.5mm 铜鳍片密集阵列 + 盖板(真机鳍片密度)
  const finBase = LX.geo.rbox(0.57, 0.16, 0.28, M.mat(0x30353d, { metalness: 0.6, roughness: 0.4 }), 0.008, 1);
  finBase.position.set(0.35, 0.08, 0.165);
  const finT = [];
  for (let i = 0; i < 26; i++) finT.push({ p: [0.35, 0.08, 0.04 + i * 0.0095], r: [0, 0, 0] });
  g.add(LX.instanced.build(new THREE.BoxGeometry(0.55, 0.16, 0.0035), M.copper(), finT));
  const finCover = LX.geo.rbox(0.58, 0.006, 0.3, M.mat(0x30353d, { metalness: 0.6, roughness: 0.4 }), 0.002, 1);
  finCover.position.set(0.35, 0.168, 0.165);

  // 热管模组(真机工艺):双蒸发管并排 + 汇流接头 + 压扁环扣 +
  // GPU 冷头铜板(四颗螺丝) + 冷凝端鞍座压入鳍片
  const mkPipe = (len) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, len, 4, 14), M.copper());
    m.geometry.rotateZ(Math.PI / 2); // 轴向 → x
    m.scale.y = 0.5;                 // 压扁成扁管
    return m;
  };
  const PY = 0.15;
  const pipeA = mkPipe(1.1);
  pipeA.position.set(-1.08, PY, -0.32);
  const pipeA2 = mkPipe(1.1);
  pipeA2.position.set(-1.08, PY, -0.22);
  const pipeB = mkPipe(0.6);
  pipeB.rotation.y = Math.PI / 2;
  pipeB.position.set(-0.55, PY, -0.02);
  const pipeC = mkPipe(0.95);
  pipeC.rotation.y = -0.12;
  pipeC.position.set(-0.05, PY, 0.3);
  // 双管汇流接头(蒸发段转入转折段)
  const joint = LX.geo.rbox(0.14, 0.045, 0.16, M.copper(), 0.008, 1);
  joint.position.set(-0.55, PY, -0.27);
  // 工艺压扁环扣(铜管收缩点)
  const mkCrimp = (x, z) => {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.006, 8, 18), M.copper());
    c.rotation.y = Math.PI / 2;
    c.scale.y = 0.55;
    c.position.set(x, PY, z);
    return c;
  };
  const crimps = [
    mkCrimp(-1.32, -0.32), mkCrimp(-1.32, -0.22),
    mkCrimp(-0.88, -0.32), mkCrimp(-0.88, -0.22),
    mkCrimp(-0.55, 0.1), mkCrimp(-0.2, 0.32),
  ];
  // 冷头(蒸发端铜板 + 四角螺丝,压在 GPU/CPU 封装上)
  const coldPlate = LX.geo.rbox(0.26, 0.02, 0.24, M.copper(), 0.006, 1);
  coldPlate.position.set(-1.38, PY, -0.27);
  const screwT = [];
  for (const [sx, sz] of [[-1.48, -0.37], [-1.28, -0.37], [-1.48, -0.17], [-1.28, -0.17]]) {
    screwT.push({ p: [sx, PY + 0.014, sz], r: [0, 0, 0] });
  }
  const plateScrews = LX.instanced.build(
    new THREE.CylinderGeometry(0.008, 0.008, 0.008, 10),
    M.mat(0x9aa2ad, { metalness: 0.9, roughness: 0.3 }), screwT);
  // 冷凝端鞍座(热管末端压入鳍片组)
  const saddle = LX.geo.rbox(0.12, 0.03, 0.16, M.mat(0x30353d, { metalness: 0.6, roughness: 0.4 }), 0.006, 1);
  saddle.position.set(0.44, PY, 0.33);

  g.add(blower, fanSpin, blurDisc, volute, finBase, finCover,
    pipeA, pipeA2, pipeB, pipeC, joint, ...crimps, coldPlate, plateScrews, saddle);

  /* ----- 热管内部工质相变:蒸发端(液→气)→ 冷凝端(气→液)循环 -----
     蒸汽粒子:红橙,沿热管快速流向鳍片;液体回流粒子:蓝色,贴下壁缓回。
     颜色两端平滑过渡(蓝→红→蓝)。 */
  const P1 = new THREE.Vector3(-1.5, 0.15, -0.32), P2 = new THREE.Vector3(-0.5, 0.15, -0.32);
  const P3 = new THREE.Vector3(-0.5, 0.15, 0.24), P4 = new THREE.Vector3(0.42, 0.15, 0.3);
  const segLens = [];
  let pipeTotal = 0;
  const pipePath = [P1, P2, P3, P4];
  for (let i = 0; i < pipePath.length - 1; i++) {
    const l = pipePath[i].distanceTo(pipePath[i + 1]);
    segLens.push(l); pipeTotal += l;
  }
  const pipePoint = (t, out) => {
    let dd = t * pipeTotal;
    for (let i = 0; i < segLens.length; i++) {
      if (dd <= segLens[i] || i === segLens.length - 1) {
        const k = Math.min(dd / segLens[i], 1);
        return out.lerpVectors(pipePath[i], pipePath[i + 1], k);
      }
      dd -= segLens[i];
    }
    return out.copy(pipePath[pipePath.length - 1]);
  };
  const NV = 10, NL = 10;
  const vapor = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff5030, emissiveIntensity: 1.6, roughness: 0.3 }), NV);
  const liquid = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2a6bff, emissiveIntensity: 1.4, roughness: 0.3 }), NL);
  vapor.position.y = 0.03; liquid.position.y = -0.03; // 汽相走管芯上方,液相回流贴下壁
  g.add(vapor, liquid);
  const vapState = [], liqState = [];
  const rr2 = LX.textures.random(9);
  for (let i = 0; i < NV; i++) vapState.push({ t: i / NV, sp: 0.10 + rr2() * 0.05 });
  for (let i = 0; i < NL; i++) liqState.push({ t: (i + 0.5) / NL, sp: -(0.05 + rr2() * 0.03) });
  const tmpV = new THREE.Vector3(), tmpC = new THREE.Color();
  const d = new THREE.Object3D();
  const C_LIQ = new THREE.Color(0x2a6bff), C_VAP = new THREE.Color(0xff5030);

  /* ----- 负载 → 风扇转速惯性 + 工质循环速度 ----- */
  let load = 0.35;            // 0..1(UI 滑块)
  let omega = 6, omegaTarget = 6; // rad/s,带惯性
  const OMEGA_MAX = 34;
  const RPM = () => Math.round(omega / (2 * Math.PI) * 60);

  g.userData.tick = (dt, t) => {
    // 转速惯性:平滑加减速
    omegaTarget = 5 + load * (OMEGA_MAX - 5);
    omega += (omegaTarget - omega) * Math.min(dt * 0.9, 1);
    fanSpin.rotation.y += omega * dt;
    // 运动模糊:转速越高越明显
    blurDisc.material.opacity = Math.min(Math.max((omega - 8) / (OMEGA_MAX - 8), 0), 1) * 0.55;
    blurDisc.rotation.z -= omega * dt * 0.6;

    // 工质循环:蒸汽流向冷凝端(快),液体回流(慢);速度随负载
    const flow = 0.55 + load * 0.75;
    for (let i = 0; i < NV; i++) {
      const v = vapState[i];
      v.t = (v.t + v.sp * flow * dt) % 1;
      pipePoint(v.t, tmpV);
      // 相变颜色:蒸发端(左)变红,冷凝端(右)回蓝
      tmpC.lerpColors(C_VAP, C_LIQ, Math.min(Math.max((v.t - 0.55) / 0.4, 0), 1));
      if (v.t < 0.12) tmpC.lerp(C_LIQ, 1 - v.t / 0.12);
      vapor.setColorAt(i, tmpC);
      d.position.copy(tmpV).add(vapor.position);
      d.scale.setScalar(0.8 + Math.sin(t * 8 + i * 2) * 0.2);
      d.updateMatrix();
      vapor.setMatrixAt(i, d.matrix);
    }
    for (let i = 0; i < NL; i++) {
      const v = liqState[i];
      v.t += v.sp * (0.4 + load * 0.5) * dt;
      if (v.t < 0) v.t += 1;
      if (v.t > 1) v.t -= 1;
      pipePoint(1 - v.t, tmpV).y -= 0.012;
      tmpC.copy(C_LIQ);
      liquid.setColorAt(i, tmpC);
      d.position.copy(tmpV).add(liquid.position);
      d.updateMatrix();
      liquid.setMatrixAt(i, d.matrix);
    }
    vapor.instanceColor.needsUpdate = true;
    liquid.instanceColor.needsUpdate = true;
    vapor.instanceMatrix.needsUpdate = true;
    liquid.instanceMatrix.needsUpdate = true;

    const el = document.getElementById('cooling-status');
    if (el) {
      const phase = load > 0.55 ? '高负载:蒸发端大量吸热(液→气),气流加速' : '低负载:少量工质循环,风扇低速静音';
      el.textContent = `负载 ${Math.round(load * 100)}% · 风扇 ${RPM()} RPM · ${phase}`;
    }
  };

  g.userData.api = {
    setLoad(v) { load = Math.min(Math.max(v, 0), 1); },
    get load() { return load; },
  };
  return g;
};
