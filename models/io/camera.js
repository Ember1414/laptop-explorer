/* ============================================================
 * models/io/camera.js — 摄像头模组
 * 光线穿过镜头组(多片透镜)→ 打在 CMOS 传感器网格上 →
 * 被击中的像素点亮(光电转换),亮起的像素组成"拍摄的图像"。
 * 循环演示:光线扫过画面 → 网格逐点点亮 → 成像完成 → 重置。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.camera = {};

const MC = LX.materials;

function cLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 72;
  const g = c.getContext('2d');
  g.font = 'bold 34px "Segoe UI", "Microsoft YaHei", monospace';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(text, 160, 50);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(1.05, 0.235, 1);
  return sp;
}

LX.models.camera.build = function () {
  const g = new THREE.Group();

  // 底板
  const sub = LX.geo.rbox(1.7, 0.06, 1.2, MC.pcb(), 0.014, 2);
  sub.position.set(0.25, 0.03, 0);
  g.add(sub);

  // 镜筒 + 多片透镜(玻璃透镜组)
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.55, 28, 1, true),
    MC.mat(0x23272e, { metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(-0.62, 0.4, 0);
  g.add(barrel);
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x8ab8d8, transparent: true, opacity: 0.30, roughness: 0.03,
    clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.1,
  });
  const lenses = [];
  for (let i = 0; i < 4; i++) {
    const L = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), lensMat);
    L.rotation.z = -Math.PI / 2;
    L.scale.z = 0.35;
    L.position.set(-0.75 + i * 0.11, 0.4, 0);
    g.add(L);
    lenses.push(L);
  }

  // CMOS 传感器:网格基板 + 像素点阵(InstancedMesh)
  const sensor = LX.geo.rbox(0.9, 0.04, 0.9, MC.mat(0x1a2029, { metalness: 0.5, roughness: 0.4 }), 0.006, 1);
  sensor.position.set(0.3, 0.38, 0);
  g.add(sensor);
  const G = 12;                       // 12×12 像素
  const pxGeo = new THREE.BoxGeometry(0.055, 0.02, 0.055);
  const pxMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const pixels = new THREE.InstancedMesh(pxGeo, pxMat, G * G);
  const pxState = [];                 // 每像素:已点亮亮度 0..1
  const d = new THREE.Object3D();
  const cc = new THREE.Color();
  let k = 0;
  for (let r = 0; r < G; r++)
    for (let c = 0; c < G; c++) {
      d.position.set(0.3 - 0.375 + (c + 0.5) / G * 0.75, 0.42, -0.375 + (r + 0.5) / G * 0.75);
      d.updateMatrix();
      pixels.setMatrixAt(k, d.matrix);
      cc.setHex(0x101820);
      pixels.setColorAt(k, cc);
      pxState.push(0);
      k++;
    }
  pixels.instanceMatrix.needsUpdate = true;
  pixels.instanceColor.needsUpdate = true;
  g.add(pixels);

  // 入射光线(3 束,从镜头到当前扫描的像素)
  const rayGroup = new THREE.Group();
  g.add(rayGroup);
  const RAYS = 3, SEG = 8;
  const rays = [];
  for (let i = 0; i < RAYS; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }));
    rayGroup.add(line);
    rays.push(line);
  }

  const labLens = cLabel('镜头组(折射光线)', '#8fd4ff'); labLens.position.set(-0.62, 0.85, 0);
  const labCmos = cLabel('CMOS 传感器(光电转换)', '#9fe8b0'); labCmos.position.set(0.3, 0.85, 0);
  g.add(labLens, labCmos);

  /* ----- 演示时间轴:光线扫描 → 像素点亮 → 成像 ----- */
  let scanT = 0;   // 0..1 扫描进度(按行扫过 CMOS)
  let phaseT = 0;  // 每行内光线晃动

  // "要拍的画面":用函数生成每个像素的目标亮度(简易风景:天/山/太阳)
  function sceneBrightness(r, c) {
    const nx = c / (G - 1), ny = r / (G - 1);
    const sunD = Math.hypot(nx - 0.72, ny - 0.28);
    const sun = Math.max(0, 1 - sunD * 3.4);
    const sky = 0.35 + (1 - ny) * 0.35;
    const mountain = ny > 0.62 ? 0.22 : 0;
    return Math.min(1, sky * 0.75 + sun * 0.9 + mountain + (nx * 0.1));
  }

  g.userData.tick = (dt, t) => {
    scanT += dt * 0.16;          // 一幅图约 6 秒
    if (scanT >= 1.15) {         // 完成后重置(重拍)
      scanT = 0;
      pxState.fill(0);
      for (let i = 0; i < G * G; i++) { cc.setHex(0x101820); pixels.setColorAt(i, cc); }
      pixels.instanceColor.needsUpdate = true;
    }
    phaseT += dt;

    const rowsDone = Math.min(Math.floor(scanT * G), G);
    const rowFloat = scanT * G;
    const frac = rowFloat - rowsDone;

    // 当前行:光线从镜头射向该行的像素(3 束,扫过行内不同位置)
    const row = Math.min(rowsDone, G - 1);
    const lensExit = new THREE.Vector3(-0.42, 0.4, 0);
    for (let li = 0; li < RAYS; li++) {
      const cTarget = row === rowsDone ? (li * 4 + Math.floor(phaseT * 6)) % G : Math.floor(G * 0.5);
      const target = new THREE.Vector3(
        0.3 - 0.375 + (cTarget + 0.5) / G * 0.75, 0.42, -0.375 + (row + 0.5) / G * 0.75);
      const pos = rays[li].geometry.attributes.position;
      for (let s = 0; s <= SEG; s++) {
        const kk = s / SEG;
        const p = new THREE.Vector3().lerpVectors(lensExit, target, kk);
        p.x -= Math.sin(kk * Math.PI) * 0.03; // 轻微折射弯曲
        pos.setXYZ(s, p.x, p.y, p.z);
      }
      pos.needsUpdate = true;
      rays[li].material.opacity = row === rowsDone ? (0.35 + Math.sin(t * 10 + li * 2) * 0.3) : 0;
    }

    // 当前行像素逐个点亮:亮度 = 场景亮度(光电转换)
    if (row === rowsDone) {
      for (let c = 0; c < G; c++) {
        const idx = row * G + c;
        const target = sceneBrightness(row, c);
        if (pxState[idx] < target) {
          pxState[idx] = Math.min(pxState[idx] + dt * 2.2, target);
          const b = 0.06 + pxState[idx] * 0.94;
          // 色调:亮度高偏暖,低偏冷
          cc.setRGB(b, b * (0.55 + target * 0.45), b * (0.4 + target * 0.3));
          pixels.setColorAt(idx, cc);
        }
      }
      pixels.instanceColor.needsUpdate = true;
    }

    // 面板状态:扫描进度
    const el = document.getElementById('camera-status');
    if (el) {
      el.textContent = scanT < 1
        ? `曝光中:第 ${Math.min(rowsDone + 1, G)}/${G} 行 · 光子 → 光电二极管 → 电荷(电压)`
        : '成像完成:144 万分之一真实像素数的演示网格(LOD 降采样)· 片刻后重新曝光';
    }
  };

  g.userData.api = {
    /** 重新曝光(清空传感器,从头扫描) */
    shot() {
      scanT = 0;
      pxState.fill(0);
      for (let i = 0; i < G * G; i++) { cc.setHex(0x101820); pixels.setColorAt(i, cc); }
      pixels.instanceColor.needsUpdate = true;
    },
  };

  return g;
};
