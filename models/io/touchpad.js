/* ============================================================
 * models/io/touchpad.js — 触控板(电容式)
 * build({demo}) 两种形态:
 *   demo:false  整机装配视图——真机尺寸(1.09×0.57,恰匹配 C 壳开槽
 *               1.05×0.53),深色玻璃面板 + FPC 排线,电极隐藏于面板下
 *   demo:true   触控板节点——放大分解:电极网格发光 + 手指胶囊 +
 *               电场线形变 + 判定坐标高亮(自动扫描/滑块可控)
 * 覆盖 UI:data-node="touchpad"(自动演示开关)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.touchpad = {};

const MTP = LX.materials;

LX.models.touchpad.build = function (opts = {}) {
  const demo = opts.demo !== false;
  const g = new THREE.Group();
  // 演示视图放大分解;装配视图玻璃精确匹配 C 壳开槽(1.05×0.53,留 5mm 发丝露边,
  // 不再露出铝板法兰形成的"框"),组件抬高至玻璃面与 C 壳面齐平
  const W = demo ? 1.5 : 1.04;
  const D = demo ? 1.0 : 0.52;
  const plateW = W + (demo ? 0.16 : 0.05);
  const plateD = D + (demo ? 0.16 : 0.05);

  // 触控板基板(装配视图整体藏在 C 壳之下)
  const plate = LX.geo.rbox(plateW, 0.05, plateD, MTP.mat(0x8f97a2, { metalness: 0.7, roughness: 0.4, roughnessMap: LX.textures.brushed() }), 0.012, 2);
  plate.position.y = 0.025;
  g.add(plate);

  // 深色玻璃面板(真机触控板为高光玻璃;装配视图与开槽等大,边到边)
  const glass = new THREE.Mesh(new THREE.BoxGeometry(demo ? W - 0.04 : W, 0.004, demo ? D - 0.04 : D),
    new THREE.MeshPhysicalMaterial({
      color: 0x11151b, roughness: 0.08, metalness: 0.1,
      clearcoat: 1, clearcoatRoughness: 0.06,
    }));
  glass.position.y = 0.052;
  g.add(glass);

  // FPC 排线尾部 + 连接端(装配视图隐藏在键盘托盘下,与真机一致)
  const fpcMat = MTP.mat(0xc9a86a, { roughness: 0.5, metalness: 0.3 });
  const fpcY = demo ? 0.045 : 0.028;
  const fpc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.1, fpcY, -D / 2 - 0.04),
    new THREE.Vector3(0.14, fpcY + 0.005, -D / 2 - 0.15),
    new THREE.Vector3(0.16, fpcY, -D / 2 - 0.26),
  ]), 24, 0.014, 8, false), fpcMat);
  const fpcTip = LX.geo.rbox(0.09, 0.012, 0.04, MTP.mat(0x2b2f36, { metalness: 0.5, roughness: 0.4 }), 0.002, 1);
  fpcTip.position.set(0.16, fpcY, -D / 2 - 0.29);
  g.add(fpc, fpcTip);

  // 装配视图:玻璃下隐约的电极网格(真机电容图案)+ 底部两颗微动开关点
  if (!demo) {
    const patMat = new THREE.LineBasicMaterial({ color: 0x3a7fae, transparent: true, opacity: 0.18 });
    const pat = [];
    for (let i = 0; i <= 14; i++) {
      const x = -W / 2 + 0.03 + (i / 14) * (W - 0.06);
      pat.push(x, 0.0545, -D / 2 + 0.03, x, 0.0545, D / 2 - 0.03);
    }
    for (let j = 0; j <= 9; j++) {
      const z = -D / 2 + 0.03 + (j / 9) * (D - 0.06);
      pat.push(-W / 2 + 0.03, 0.0545, z, W / 2 - 0.03, 0.0545, z);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pat, 3));
    g.add(new THREE.LineSegments(pg, patMat));
    for (const sx of [-0.3, 0.3]) {
      const sw = LX.geo.cyl(0.014, 0.002, MTP.mat(0x2a3242, { roughness: 0.4, metalness: 0.3 }), 12);
      sw.position.set(sx, 0.0545, D / 2 - 0.06);
      g.add(sw);
    }
    return g;
  }

  // 电极网格:发光网格线(横竖各 8/12 条)
  const gridMat = new THREE.LineBasicMaterial({ color: 0x2a6ba8, transparent: true, opacity: 0.7 });
  const gridPts = [];
  for (let i = 0; i <= 12; i++) {
    const x = -W / 2 + (i / 12) * W;
    gridPts.push(x, 0.055, -D / 2, x, 0.055, D / 2);
  }
  for (let j = 0; j <= 8; j++) {
    const z = -D / 2 + (j / 8) * D;
    gridPts.push(-W / 2, 0.055, z, W / 2, 0.055, z);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
  g.add(new THREE.LineSegments(gridGeo, gridMat));
  // 交叉点电极(小点)
  const nodeGeo = new THREE.SphereGeometry(0.014, 6, 6);
  const nodeMat = new THREE.MeshBasicMaterial({ color: 0x4c9fd8, transparent: true, opacity: 0.75 });
  const nodeInst = new THREE.InstancedMesh(nodeGeo, nodeMat, 13 * 9);
  {
    const d = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i <= 12; i++)
      for (let j = 0; j <= 8; j++) {
        d.position.set(-W / 2 + (i / 12) * W, 0.058, -D / 2 + (j / 8) * D);
        d.updateMatrix();
        nodeInst.setMatrixAt(k, d.matrix);
        k++;
      }
    nodeInst.instanceMatrix.needsUpdate = true;
  }
  g.add(nodeInst);

  // 手指(胶囊体)
  const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 6, 12),
    MTP.mat(0xe8b89a, { roughness: 0.55, metalness: 0 }));
  finger.rotation.x = Math.PI / 2 - 0.35;
  finger.position.set(0, 0.22, 0);
  g.add(finger);

  // 电场线:从手指底部到附近 3 个最近电极交叉点的扭曲曲线(每帧重算)
  const fieldGroup = new THREE.Group();
  g.add(fieldGroup);
  const FIELD_SEGS = 14;
  const fieldLines = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((FIELD_SEGS + 1) * 3), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: demo ? 0.75 : 0 }));
    fieldGroup.add(line);
    fieldLines.push(line);
  }

  // 判定坐标高亮:十字 + 圆环(transparent 打开,opacity 脉动才生效)
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true });
  const crossBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.014), crossMat);
  const crossBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.006, 0.24), crossMat);
  const crossRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 24), crossMat);
  crossRing.rotation.x = Math.PI / 2;
  crossBar1.position.y = crossBar2.position.y = crossRing.position.y = 0.062;
  crossBar1.visible = crossBar2.visible = crossRing.visible = false;
  g.add(crossBar1, crossBar2, crossRing);

  // 状态
  let fingerT = 0;          // 自动扫描相位
  let auto = true;
  let manual = { x: 0.3, z: 0.2 };
  const statusEl = () => document.getElementById('touchpad-status');

  const nodeAt = (i, j) => new THREE.Vector3(-W / 2 + (i / 12) * W, 0.058, -D / 2 + (j / 8) * D);

  function nearestNodes(fx, fz) {
    // 找最近 3 个交叉点(供电场线连接)
    const list = [];
    for (let i = 0; i <= 12; i++)
      for (let j = 0; j <= 8; j++) {
        const p = nodeAt(i, j);
        const d = Math.hypot(p.x - fx, p.z - fz);
        list.push({ p, d, i, j });
      }
    list.sort((a, b) => a.d - b.d);
    return list.slice(0, 3);
  }

  g.userData.tick = (dt, t) => {
    // 手指自动扫描(8 字轨迹);手动模式由滑块控制
    if (auto) {
      fingerT += dt * 0.5;
      manual.x = Math.sin(fingerT) * 0.5;
      manual.z = Math.cos(fingerT * 0.8) * 0.3;
    }
    finger.position.set(manual.x, 0.2 + Math.abs(Math.sin(t * 3)) * 0.015, manual.z);

    // 电场线:手指底部 → 三个最近电极(带弯曲扭曲)
    const fBase = new THREE.Vector3(manual.x, 0.12, manual.z);
    const near = nearestNodes(manual.x, manual.z);
    fieldLines.forEach((line, li) => {
      const target = near[li].p;
      const pos = line.geometry.attributes.position;
      for (let s = 0; s <= FIELD_SEGS; s++) {
        const k = s / FIELD_SEGS;
        const p = new THREE.Vector3().lerpVectors(fBase, target, k);
        // 扭曲:垂直方向按正弦弯曲 + 顶点吸附
        const bend = Math.sin(k * Math.PI) * 0.06;
        p.y += bend;
        p.x += Math.sin(k * 9 + t * 4 + li * 2) * 0.015 * k;
        p.z += Math.cos(k * 7 + t * 3 + li * 2) * 0.015 * k;
        pos.setXYZ(s, p.x, p.y, p.z);
      }
      pos.needsUpdate = true;
      line.material.opacity = 0.4 + Math.sin(t * 6 + li) * 0.25;
    });

    // 判定坐标:最近交叉点(量化)→ 高亮十字
    const gi = Math.round((manual.x + W / 2) / W * 12);
    const gj = Math.round((manual.z + D / 2) / D * 8);
    const gp = nodeAt(Math.min(Math.max(gi, 0), 12), Math.min(Math.max(gj, 0), 8));
    crossBar1.position.set(gp.x, 0.062, gp.z);
    crossBar2.position.set(gp.x, 0.062, gp.z);
    crossRing.position.set(gp.x, 0.062, gp.z);
    crossBar1.visible = crossBar2.visible = crossRing.visible = true;
    crossMat.opacity = 0.7 + Math.sin(t * 8) * 0.3;
    const el = statusEl();
    if (el) el.textContent = `侦测坐标:(${gp.x.toFixed(2)}, ${gp.z.toFixed(2)}) · 电极 [${Math.min(gi, 12)},${Math.min(gj, 8)}] · 电容变化 → 坐标判定`;
  };

  g.userData.api = {
    setAuto(v) { auto = !!v; },
    setFinger(x, z) { auto = false; manual.x = x; manual.z = z; },
  };
  return g;
};
