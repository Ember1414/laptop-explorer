/* ============================================================
 * core/particleSystem.js — 通用发光粒子流(核心复用件)
 * 用于电流、电子漂移、锂离子迁移、光子等"流动粒子"演示。
 *
 * 用法:
 *   const flow = LX.particles.createFlow({
 *     curve: new THREE.CatmullRomCurve3([...]), // 粒子轨迹(任意 Curve)
 *     count: 220,        // 粒子数(内部按设备能力做 LOD 降采样)
 *     color: 0x7fd4ff,   // 发光颜色(配合 Bloom 出光晕)
 *     size: 0.03,        // 粒子尺寸(世界单位)
 *     speed: 0.12,       // 沿曲线运动速度(周/秒)
 *     tail: 3,           // 每个粒子的拖尾点数(0 = 无拖尾)
 *   });
 *   scene.add(flow.group);
 *   // 每帧:flow.update(dt);
 *   // 结束:flow.dispose();
 *
 * LOD 策略(QUALITY_BASELINE 总则):按 hardwareConcurrency 降采样,
 * 后续阶段如需更细的分级(距离/ importance),在此文件扩展。
 * ============================================================ */
window.LX = window.LX || {};
LX.particles = {};

LX.particles.createFlow = function (opts) {
  const {
    curve,
    count = 200,
    color = 0x7fd4ff,
    size = 0.03,
    speed = 0.12,
    tail = 3,
    tailGap = 0.008,
    opacity = 0.95,
  } = opts || {};

  if (!curve) throw new Error('LX.particles.createFlow: 需要提供 curve');

  // LOD:按设备能力降采样(低核设备粒子减半)
  const cores = navigator.hardwareConcurrency || 4;
  const quality = Math.min(1, cores / 8);
  const n = Math.max(24, Math.round(count * (0.5 + 0.5 * quality)));

  // 预采样曲线为查找表,避免每帧曲线求值
  const SAMPLES = 1024;
  const lut = new Float32Array(SAMPLES * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < SAMPLES; i++) {
    curve.getPointAt(i / (SAMPLES - 1), p);
    lut[i * 3] = p.x; lut[i * 3 + 1] = p.y; lut[i * 3 + 2] = p.z;
  }
  const sample = (t, out) => {
    let s = (t % 1 + 1) % 1 * (SAMPLES - 1);
    const i = Math.floor(s);
    const f = s - i;
    const j = Math.min(i + 1, SAMPLES - 1);
    out.x = lut[i * 3] + (lut[j * 3] - lut[i * 3]) * f;
    out.y = lut[i * 3 + 1] + (lut[j * 3 + 1] - lut[i * 3 + 1]) * f;
    out.z = lut[i * 3 + 2] + (lut[j * 3 + 2] - lut[i * 3 + 2]) * f;
    return out;
  };

  // 主粒子 + 拖尾:拖尾点是同相位减去 gap*k,尺寸/透明度衰减
  const total = n * (1 + tail);
  const positions = new Float32Array(total * 3);
  const phases = new Float32Array(n);
  const rnd = Math.random;
  for (let i = 0; i < n; i++) phases[i] = rnd();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color, size, transparent: true, opacity,
    blending: THREE.AdditiveBlending,   // 加色混合:Bloom 拾取后呈真实光晕
    depthWrite: false, sizeAttenuation: true,
  });

  const group = new THREE.Group();
  group.add(new THREE.Points(geo, material));
  group.userData.isParticleFlow = true;

  let disposed = false;
  const tmp = new THREE.Vector3();

  return {
    group,
    /** 每帧推进(由 sceneManager 主循环调用) */
    update(dt) {
      if (disposed) return;
      let w = 0;
      for (let i = 0; i < n; i++) {
        phases[i] = (phases[i] + speed * dt) % 1;
        for (let k = 0; k <= tail; k++) {
          sample(phases[i] - k * tailGap, tmp);
          positions[w * 3] = tmp.x;
          positions[w * 3 + 1] = tmp.y;
          positions[w * 3 + 2] = tmp.z;
          w++;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
    dispose() {
      disposed = true;
      geo.dispose();
      material.dispose();
    },
  };
};
