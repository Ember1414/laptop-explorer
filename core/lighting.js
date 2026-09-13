/* ============================================================
 * core/lighting.js — 三点布光 + 程序化环境 + 阴影/地面(统一设置)
 * QUALITY_BASELINE 一.2/一.3:主光 + 补光 + 轮廓光,PMREM 环境贴图,
 * PCFSoft 阴影。所有阶段共用此布光,不得各部件自带光照。
 * ============================================================ */
window.LX = window.LX || {};
LX.lighting = {};

/**
 * 搭建舞台光照。
 * @returns {object} { grid } — grid 供场景管理器按层级缩放显示
 */
LX.lighting.setup = function (scene) {
  // 程序化环境贴图(RoomEnvironment → PMREM),提供真实反射
  const pmrem = new THREE.PMREMGenerator(LX.renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;

  // 半球环境光(很弱,主要靠 env 贴图)
  scene.add(new THREE.HemisphereLight(0xcdd9e5, 0x20242b, 0.35));

  // 主光:从后上方来,避免在 C 壳上形成直射镜头的镜面热点;带柔和阴影
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 10, -7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -6;
  key.shadow.camera.right = key.shadow.camera.top = 6;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  // 补光:暖色,压死黑阴影
  const fill = new THREE.DirectionalLight(0xfff4e0, 0.45);
  fill.position.set(-6, 3, 8);
  scene.add(fill);

  // 轮廓光:冷蓝,勾边缘(低强度,避免掠射宽反射)
  const rim = new THREE.DirectionalLight(0x6ea8ff, 0.4);
  rim.position.set(-9, 2.5, -3);
  scene.add(rim);

  // 接影地面(ShadowMaterial 只显示阴影;不再绘制参考网格,避免外围方框)
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShadowMaterial({ opacity: 0.35 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.015;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  return { key, fill, rim };
};
