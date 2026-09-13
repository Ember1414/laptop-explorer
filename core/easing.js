/* ============================================================
 * core/easing.js — 缓动函数库
 * 所有动画统一从这里取缓动,保证运动"有物理感"(QUALITY_BASELINE 三.9)
 * ============================================================ */
window.LX = window.LX || {};

LX.Ease = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};
