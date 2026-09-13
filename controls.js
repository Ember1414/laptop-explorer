/* ============================================================
 * controls.js — OrbitControls 封装
 * 全层级共用同一个实例(需求 3):阻尼旋转 + 滚轮缩放,
 * 过渡期间由 sceneManager 切换 enabled。
 * ============================================================ */
window.LX = window.LX || {};

LX.createControls = function (camera, domElement) {
  const controls = new THREE.OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.05;
  controls.maxDistance = 60;
  // 平移:右键拖拽 / 双指触屏(WASD 键盘平移在场景管理器中实现)
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.panSpeed = 0.9;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  return controls;
};
