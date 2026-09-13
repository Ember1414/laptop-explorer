/* ============================================================
 * models/cpu/registers.js — 寄存器组
 * 8 个寄存器槽(R0..R7),每个槽一位值显示 + 写入脉冲扫掠动画:
 * 一道写入光沿槽阵列移动,值位随写入翻转并发光。
 * ============================================================ */
window.LX = window.LX || {};
LX.models = LX.models || {};
LX.models.registers = {};

LX.models.registers.build = function () {
  const M = LX.materials;
  const g = new THREE.Group();

  // 基板
  const sub = LX.geo.rbox(2.0, 0.05, 1.0, M.pcb(), 0.015, 2);
  sub.position.y = 0.025;
  g.add(sub);

  // 8 个寄存器槽(2 行 × 4 列)
  const slots = [];
  const slotGeo = new THREE.RoundedBoxGeometry(0.36, 0.1, 0.34, 2, 0.012);
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++) {
      const slot = new THREE.Mesh(slotGeo, M.mat(0x232b38, { metalness: 0.6, roughness: 0.35 }));
      slot.position.set(-0.72 + c * 0.48, 0.1, -0.22 + r * 0.44);
      const lab = (() => {
        const cv = document.createElement('canvas');
        cv.width = 128; cv.height = 64;
        const cg = cv.getContext('2d');
        cg.font = 'bold 30px monospace';
        cg.textAlign = 'center';
        cg.fillStyle = '#9fd8ff';
        cg.fillText('R' + (r * 4 + c), 64, 42);
        const tex = new THREE.CanvasTexture(cv);
        tex.encoding = THREE.sRGBEncoding;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sp.scale.set(0.3, 0.15, 1);
        sp.position.set(slot.position.x, 0.32, slot.position.z);
        return sp;
      })();
      // 值位:槽顶小灯(写入时亮)
      const bit = LX.geo.rbox(0.3, 0.012, 0.06,
        M.mat(0x10141c, { emissive: 0x51e88c, emissiveIntensity: 0.05 }), 0, 1);
      bit.position.set(slot.position.x, 0.156, slot.position.z);
      slots.push({ slot, bit: bit.material, lab });
      g.add(slot, bit, lab);
    }

  // 写入光扫掠:每 0.9s 写一个寄存器,值翻转
  let wi = 0, acc = 0;
  g.userData.tick = (dt, t) => {
    acc += dt;
    if (acc > 0.9) {
      acc = 0;
      const s = slots[wi % slots.length];
      const on = Math.random() < 0.5 ? 1.6 : 0.12;
      s.bit.emissiveIntensity = on;
      wi++;
    }
    // 所有位缓暗
    for (const s of slots) s.bit.emissiveIntensity *= (1 - Math.min(dt * 1.2, 1));
  };
  return g;
};
