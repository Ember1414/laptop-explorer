/* ============================================================
 * models/graphics/rasterPipeline.js — 光栅化管线(教学核心)
 * 五个阶段沿流水线排布,15 秒一个循环逐段点亮:
 *   ① 顶点数据   三个发光点(携带 R/G/B 顶点色)
 *   ② 顶点着色器 点被"矩阵变换"实时旋转/缩放( continuously )
 *   ③ 图元装配   三点连成线框三角形(逐边绘出)
 *   ④ 光栅化     三角形内部被像素网格逐行填充(过程可见)
 *   ⑤ 片元着色   每个像素按光照公式实时变色(光源旋转)
 * 活跃阶段高亮,非活跃阶段压暗——外行也能看懂执行顺序。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.raster = {};

const STAGE_DEFS = [
  { name: '① 顶点数据', color: 0x4cc2ff },
  { name: '② 顶点着色器', color: 0xffd75e },
  { name: '③ 图元装配', color: 0xff9a4d },
  { name: '④ 光栅化', color: 0x51e88c },
  { name: '⑤ 片元着色', color: 0xc79fff },
];

function rLabel(text, color, scale) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 80;
  const g = c.getContext('2d');
  g.font = 'bold 40px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 160, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale || 1.15, (scale || 1.15) * 0.25, 1);
  return sp;
}

LX.models.raster.build = function () {
  const M = LX.materials;
  const g = new THREE.Group();
  const CYCLE = 15, PER = 3; // 15s 循环,每段 3s

  // 底板
  const slab = LX.geo.rbox(8.0, 0.08, 1.8, M.mat(0x14181f, { metalness: 0.45, roughness: 0.5, roughnessMap: LX.textures.grain() }), 0.02, 1);
  slab.position.y = 0.04;
  g.add(slab);

  const zones = [];
  const zoneX = (i) => -3.1 + i * 1.55;

  // 阶段底座光圈(活跃时发亮)
  for (let i = 0; i < 5; i++) {
    const st = STAGE_DEFS[i];
    const pad = LX.geo.rbox(1.34, 0.02, 1.5,
      new THREE.MeshStandardMaterial({ color: 0x232b38, metalness: 0.4, roughness: 0.5, emissive: st.color, emissiveIntensity: 0.05 }),
      0.01, 1);
    pad.position.set(zoneX(i), 0.09, 0);
    const label = rLabel(st.name, '#' + st.color.toString(16).padStart(6, '0'));
    label.position.set(zoneX(i), 1.15, 0);
    g.add(pad, label);
    zones.push({ st, pad, i, occ: 0 });
  }

  /* ----- Z0 顶点数据:三个发光点 ----- */
  const VERTS = [new THREE.Vector3(-0.28, 0.18, 0.3), new THREE.Vector3(0.3, 0.18, 0.3), new THREE.Vector3(0.01, 0.18, -0.32)];
  const VCOL = [0xff6666, 0x66ff88, 0x6699ff];
  const z0Pts = VCOL.map((c) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: c, emissiveIntensity: 1.6, roughness: 0.3 }));
    return p;
  });

  /* ----- Z1 顶点着色器:点被矩阵变换(旋转+缩放) ----- */
  const z1Group = new THREE.Group();
  z1Group.position.set(zoneX(1), 0.1, 0);
  // "变换矩阵"网格平面
  const gridHelper = new THREE.GridHelper(0.9, 6, 0xffd75e, 0x8a7a3a);
  gridHelper.position.y = 0.08;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.35;
  z1Group.add(gridHelper);
  const z1Pts = VCOL.map((c, i) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: c, emissiveIntensity: 1.4, roughness: 0.3 }));
    p.userData.base = VERTS[i].clone();
    z1Group.add(p);
    return p;
  });
  const matrixGhost = LX.geo.rbox(0.62, 0.5, 0.02,
    new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.12, side: THREE.DoubleSide }), 0, 1);
  matrixGhost.position.set(0, 0.35, -0.32);
  z1Group.add(matrixGhost);
  z0Pts.forEach((p, i) => {
    p.position.set(zoneX(0) + VERTS[i].x * 0.6, VERTS[i].y, VERTS[i].z * 0.9);
    g.add(p);
  });

  /* ----- Z2 图元装配:线框三角形(逐边绘出) ----- */
  const z2Group = new THREE.Group();
  z2Group.position.set(zoneX(2), 0.1, 0);
  const triPts = VERTS.map(v => v.clone().multiplyScalar(0.9));
  const edges = [];
  for (let i = 0; i < 3; i++) {
    const a = triPts[i], b = triPts[(i + 1) % 3];
    const len = a.distanceTo(b);
    const e = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.9 }));
    e.position.copy(a).add(b).multiplyScalar(0.5).setY(0.18);
    e.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    e.scale.x = 0.001; // 逐边生长
    z2Group.add(e);
    edges.push(e);
  }
  const z2Pts = triPts.map((pt, i) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: VCOL[i], emissiveIntensity: 1.2, roughness: 0.3 }));
    p.position.copy(pt).setY(0.18);
    z2Group.add(p);
    return p;
  });
  g.add(z2Group);

  /* ----- Z3 光栅化:像素网格逐行填充 ----- */
  const GX = 14, GY = 9, CELL = 0.092;
  const gridGeo = new THREE.BoxGeometry(CELL * 0.88, 0.02, CELL * 0.88);
  const gridMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 });
  const grid = new THREE.InstancedMesh(gridGeo, gridMat, GX * GY);
  const col = new THREE.Color(); // 须在构建块之前声明(修复 TDZ 崩溃:进入本节点即冻结)
  const gridData = []; // {x,z,order}
  {
    const d = new THREE.Object3D();
    let k = 0;
    for (let ry = 0; ry < GY; ry++)
      for (let rx = 0; rx < GX; rx++) {
        d.position.set(zoneX(3) + (rx - (GX - 1) / 2) * CELL, 0.11, (ry - (GY - 1) / 2) * CELL);
        d.updateMatrix();
        grid.setMatrixAt(k, d.matrix);
        col.setHex(0x1a2230);
        grid.setColorAt(k, col);
        gridData.push({ order: ry * GX + rx });
        k++;
      }
    grid.instanceMatrix.needsUpdate = true;
    grid.instanceColor.needsUpdate = true;
  }
  const gridGroup = new THREE.Group();
  gridGroup.position.set(zoneX(3), 0, 0);
  gridGroup.add(grid);
  g.add(gridGroup);

  /* ----- Z4 片元着色:光照公式实时变色 ----- */
  const shadeGrid = new THREE.InstancedMesh(gridGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.15 }), GX * GY);
  {
    const d = new THREE.Object3D();
    const c2 = new THREE.Color();
    let k = 0;
    for (let ry = 0; ry < GY; ry++)
      for (let rx = 0; rx < GX; rx++) {
        d.position.set(zoneX(4) + (rx - (GX - 1) / 2) * CELL, 0.11, (ry - (GY - 1) / 2) * CELL);
        d.updateMatrix();
        shadeGrid.setMatrixAt(k, d.matrix);
        c2.setHex(0x10151d);
        shadeGrid.setColorAt(k, c2);
        k++;
      }
    shadeGrid.instanceMatrix.needsUpdate = true;
  }
  const shadeGroup = new THREE.Group();
  shadeGroup.position.set(zoneX(4), 0, 0);
  shadeGroup.add(shadeGrid);
  const lightOrb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 2.2, roughness: 0.3 }));
  lightOrb.position.set(zoneX(4), 0.85, 0);
  shadeGroup.add(lightOrb);
  g.add(shadeGroup);

  // 阶段间箭头(细长三角)
  for (let i = 0; i < 4; i++) {
    const ar = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4),
      new THREE.MeshBasicMaterial({ color: 0x8a97a8 }));
    ar.rotation.z = -Math.PI / 2;
    ar.position.set(zoneX(i) + 0.72, 0.35, 0);
    g.add(ar);
  }

  /* ----- 主时间轴:确定性 15s 循环(全部由 t 直接计算,无跨帧累加状态,不会卡住) -----
     Z2 边生长: 6.0s..9.0s   Z3 光栅填充: 9.0s..11.55s   Z4 着色填充: 12.0s..13.5s */
  const litColor = new THREE.Color();
  const shadeCol = new THREE.Color();
  const darkCell = new THREE.Color(0x10151d);
  const litCell = new THREE.Color(0x3a86d4);

  g.userData.tick = (dt, t) => {
    const tc = t % CYCLE;
    const active = Math.min(Math.floor(tc / PER), 4);
    const phase = (tc - active * PER) / PER; // 0..1 段内进度

    // 阶段光圈亮度平滑过渡
    for (const zn of zones) {
      const target = zn.i === active ? 0.85 : 0.05;
      zn.occ += (target - zn.occ) * Math.min(dt * 4, 1);
      zn.pad.material.emissiveIntensity = zn.occ;
    }

    // Z1 顶点着色器:持续旋转/缩放变换
    const ang = t * 1.1;
    const scl = 0.85 + Math.sin(t * 1.7) * 0.18;
    z1Pts.forEach((p, i) => {
      const b = p.userData.base;
      p.position.set(
        b.x * Math.cos(ang) - b.z * Math.sin(ang) * 0.6,
        0.18 + Math.sin(t * 2 + i * 2) * 0.05,
        (b.x * Math.sin(ang) + b.z * Math.cos(ang)) * 0.7);
      p.scale.setScalar(0.8 + scl * 0.25);
    });

    // Z2 图元装配:逐边生长(确定性:活跃段推进,之后的阶段保持完成态)
    edges.forEach((e, i) => {
      const k = active === 2
        ? Math.max(0, Math.min((phase - i * 0.3) / 0.35, 1))
        : (active > 2 ? 1 : 0);
      e.scale.x = Math.max(k, 0.001);
    });

    // Z3 光栅化:逐行填充(确定性:9s 起按 tc 直接计算)
    const fill3 = Math.min(Math.max((tc - 9) / (PER * 0.85), 0), 1);
    const lit = Math.floor(fill3 * GX * GY);
    for (let k2 = 0; k2 < GX * GY; k2++) {
      litColor.copy(k2 < lit ? litCell : idleColor);
      grid.setColorAt(k2, litColor);
    }
    grid.instanceColor.needsUpdate = true;

    // Z4 片元着色:光源绕转,像素按 lambert 着色(确定性:12s 起填充)
    const la = t * 1.4;
    lightOrb.position.set(zoneX(4) + Math.cos(la) * 0.55, 0.8, Math.sin(la) * 0.4);
    const fill4 = Math.min(Math.max((tc - 12) / (PER * 0.5), 0), 1);
    const L = new THREE.Vector3(Math.cos(la) * 0.8, 0.6, Math.sin(la) * 0.5).normalize();
    for (let ry = 0; ry < GY; ry++)
      for (let rx = 0; rx < GX; rx++) {
        const k2 = ry * GX + rx;
        if (k2 / (GX * GY) > fill4) { shadeGrid.setColorAt(k2, darkCell); continue; }
        const n = new THREE.Vector3(0, 1, 0);
        const px = (rx / (GX - 1) - 0.5) * 2, pz = (ry / (GY - 1) - 0.5) * 2;
        const l = new THREE.Vector3(L.x - px * 0.3, L.y, L.z - pz * 0.3).normalize();
        const diff = Math.max(0, n.dot(l));
        shadeCol.setRGB(0.1 + diff * 0.9, 0.14 + diff * 0.75, 0.1 + diff * 0.5);
        shadeGrid.setColorAt(k2, shadeCol);
      }
    shadeGrid.instanceColor.needsUpdate = true;
    // 光源光晕
    lightOrb.material.emissiveIntensity = 1.8 + Math.sin(t * 5) * 0.5;
  };

  return g;
};
