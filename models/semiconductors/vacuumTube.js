/* ============================================================
 * models/semiconductors/vacuumTube.js — 电子管(真空三极管)
 * 与晶体管的对照教学:两者本质都是"用一个小电压控制大电流"——
 *   电子管:栅极静电场控制 灯丝→阳极 的热电子流
 *   晶体管:基极/栅极电场控制 半导体中的载流子流
 * 细节:灯丝通电发热(暗红→亮橙渐变)、热电子从灯丝表面"蒸发"
 * (初速度随机、大致朝阳极)、栅极电压越负电子流越细(被静电场
 * "调节"),阳极电流增大时阳极微亮。
 * UI:data-node="tube"(栅极电压滑块 + 灯丝电源开关)
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.vacuumTube = {};

const MTB = LX.materials;

LX.models.vacuumTube.build = function () {
  const g = new THREE.Group();

  // 底座
  const base = LX.geo.rbox(1.4, 0.08, 1.4, MTB.mat(0x23272e, { metalness: 0.4, roughness: 0.45 }), 0.015, 2);
  base.position.y = 0.04;
  g.add(base);

  // 玻璃管壳(高透明)
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.36, 1.7, 28, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xbfd8e8, transparent: true, opacity: 0.16, roughness: 0.05,
      metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide,
    }));
  glass.position.y = 0.92;
  g.add(glass);
  // 管顶圆帽
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xbfd8e8, transparent: true, opacity: 0.16, roughness: 0.05, clearcoat: 1 }));
  cap.position.y = 1.77;
  g.add(cap);

  // 灯丝:V 形两根(通电发热:暗红 → 亮橙)
  const filMat = new THREE.MeshStandardMaterial({
    color: 0x2a0a04, emissive: 0x5a1208, emissiveIntensity: 0.2, roughness: 0.5,
  });
  const filGroup = new THREE.Group();
  filGroup.position.set(0, 0.22, 0);
  for (const sx of [-0.05, 0.05]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), filMat);
    leg.position.set(sx * 0.4, 0.17, 0);
    leg.rotation.z = sx * 1.1;
    filGroup.add(leg);
  }
  const filamentTop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), filMat);
  filamentTop.position.set(0, 0.36, 0);
  filGroup.add(filamentTop);
  g.add(filGroup);

  // 阴极套管(灯丝外)
  const cathode = LX.geo.cyl(0.035, 0.4, MTB.mat(0x8a8f98, { metalness: 0.7, roughness: 0.35 }), 14);
  cathode.position.set(0, 0.42, 0);
  g.add(cathode);

  // 栅极:金属网圆筒(线框)
  const gridMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.55, 18, 6, true),
    new THREE.MeshBasicMaterial({ color: 0x66d9ff, wireframe: true, transparent: true, opacity: 0.5 }));
  gridMesh.position.set(0, 0.52, 0);
  g.add(gridMesh);

  // 阳极(板极):两片夹板
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x3a3f47, metalness: 0.8, roughness: 0.35,
    emissive: 0x1a2a1a, emissiveIntensity: 0.0,
  });
  for (const sx of [-0.2, 0.2]) {
    const plate = LX.geo.rbox(0.03, 0.7, 0.5, plateMat, 0.006, 1);
    plate.position.set(sx, 0.62, 0);
    g.add(plate);
  }
  const anodeCap = LX.geo.cyl(0.05, 0.04, MTB.mat(0x8a8f98, { metalness: 0.85, roughness: 0.3 }), 12);
  anodeCap.position.set(0, 1.35, 0);
  g.add(anodeCap);

  // 标签
  const labels = [];
  for (const [txt, y, c] of [
    ['阳极(板极)', 1.62, '#ffd75e'],
    ['栅极(控制电压)', 0.88, '#66d9ff'],
    ['阴极 / 灯丝', 0.12, '#ffb08a'],
  ]) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const cg = cv.getContext('2d');
    cg.font = 'bold 26px "Microsoft YaHei", monospace';
    cg.textAlign = 'center';
    cg.fillStyle = c;
    cg.fillText(txt, 128, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(0.72, 0.18, 1);
    sp.position.set(0.62, y, 0.3);
    labels.push(sp);
    g.add(sp);
  }
  void labels;

  /* ----- 电子(热发射)----- */
  const NE = 26;
  const eMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9fd8ff, emissiveIntensity: 2.2, roughness: 0.3 });
  const eMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 8), eMat, NE);
  g.add(eMesh);
  const parts = [];
  const rnd = LX.textures.random(90);
  for (let i = 0; i < NE; i++) parts.push({ x: 0, y: -1, z: 0, vx: 0, vy: 0, vz: 0, live: false });

  function emit() {
    const e = parts.find(p => !p.live);
    if (!e) return;
    e.live = true;
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.03;
    e.x = Math.cos(a) * r; e.z = Math.sin(a) * r;
    e.y = 0.44;
    e.vx = (Math.random() - 0.5) * 0.25;           // 初速度随机(热运动)
    e.vz = (Math.random() - 0.5) * 0.25;
    e.vy = 0.25 + Math.random() * 0.35;            // 大致朝阳极
  }

  /* ----- 状态 ----- */
  let temp = 0;        // 灯丝温度 0..1
  let powered = true;
  let Vg = -1.5;       // 栅极电压 -8..0
  const d5 = new THREE.Object3D();

  g.userData.tick = (dt, t) => {
    // 灯丝温度惯性变化
    temp += ((powered ? 1 : 0) - temp) * Math.min(dt * 0.8, 1);
    // 发光:暗红(0)→ 亮橙(1)
    filMat.emissive.setHex(0x5a1208).lerp(new THREE.Color(0xff8a30), temp);
    filMat.emissiveIntensity = 0.2 + temp * 2.4;
    filMat.color.setHex(0x2a0a04).lerp(new THREE.Color(0x7a3010), temp * 0.6);

    // 发射率 ∝ 温度^2(只有够热才发射)
    if (temp > 0.25) {
      if (Math.random() < temp * temp * dt * 26) emit();
    }

    // 电子运动:阳极吸引(+y),栅极负电压排斥(在栅极高度施加反向力)
    for (let i = 0; i < NE; i++) {
      const e = parts[i];
      if (!e.live) continue;
      e.vy += dt * (0.9 - Math.max(0, -Vg) * 0.55); // 栅极越负,向上的净加速越小甚至反向
      // 栅极位置附近的静电排斥
      const gy = 0.52;
      const distG = e.y - gy;
      if (distG > -0.12 && distG < 0.12 && Vg < -0.2) {
        e.vy -= Math.max(0, -Vg) * dt * 2.6 * (1 - Math.abs(distG) / 0.12);
        e.vx += (e.x) * dt * 3.0; // 被推离轴线(绕过栅丝)
      }
      // 轻微横向布朗
      e.vx += (Math.random() - 0.5) * dt * 0.6;
      e.vz += (Math.random() - 0.5) * dt * 0.6;
      e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
      // 到达阳极高度:被吸收(阳极微亮)
      if (e.y > 1.28) {
        e.live = false;
        plateMat.emissiveIntensity = Math.min(plateMat.emissiveIntensity + 0.12, 0.5);
      }
      // 落回/撞壁:消失
      if (e.y < 0.1 || Math.abs(e.x) > 0.38 || Math.abs(e.z) > 0.38) e.live = false;
      // 绘制
      d5.position.set(e.x, e.y, e.z);
      d5.updateMatrix();
      eMesh.setMatrixAt(i, d5.matrix);
    }
    eMesh.instanceMatrix.needsUpdate = true;
    // 未存活粒子藏到管底
    for (let i = 0; i < NE; i++) {
      if (!parts[i].live) {
        d5.position.set(0, -0.5, 0);
        d5.updateMatrix();
        eMesh.setMatrixAt(i, d5.matrix);
      }
    }
    eMesh.instanceMatrix.needsUpdate = true;

    // 阳极亮度衰减
    plateMat.emissiveIntensity *= (1 - Math.min(dt * 2, 1));

    const el = document.getElementById('tube-status');
    if (el) {
      const flow = temp < 0.25 ? '灯丝未热,无电子发射'
        : Vg < -4 ? '栅极强负压:电子流几乎被夹断'
        : Vg < -1.5 ? '栅极负压较大:电子流变细'
        : '栅极接近 0V:电子流最粗 — 小电压控制大电流';
      el.textContent = `灯丝温度 ${Math.round(temp * 100)}% · 栅极 ${Vg.toFixed(1)}V · ${flow}`;
    }
  };

  g.userData.api = {
    setVg(v) { Vg = Math.min(Math.max(v, -8), 0); },
    setPower(on) { powered = !!on; },
    get Vg() { return Vg; },
    get powered() { return powered; },
  };
  return g;
};
