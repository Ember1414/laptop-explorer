/* ============================================================
 * core/postprocessing.js — EffectComposer 后处理管线(统一配置)
 * Render → SSAO(轻微)→ Bloom(发光光晕)→ GammaCorrection → FXAA
 * 依赖 index.html 预加载的 three r147 examples/js 后处理脚本。
 * ============================================================ */
window.LX = window.LX || {};
LX.post = {};

/**
 * 创建后处理管线。
 * @returns {object} { composer, bloom, ssao, fxaa, setSize(w, h) }
 */
LX.post.create = function (renderer, scene, camera) {
  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));

  // SSAO:轻微即可,增强缝隙处层次(参数按世界尺度调校)
  const ssao = new THREE.SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssao.kernelRadius = 0.12;
  ssao.minDistance = 0.003;
  ssao.maxDistance = 0.03;
  composer.addPass(ssao);

  // Bloom:阈值 0.9,只让真正自发光的部件(屏幕/LED/粒子)出光晕
  const bloom = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.28, 0.25, 0.9);
  composer.addPass(bloom);

  // ACES 色调映射在 renderer 上;线性 → sRGB 用 Gamma 纠正(背景色需预转线性)
  composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));

  // FXAA 抗锯齿:高 DPR 设备原生分辨率已足够平滑,关闭 FXAA 换取缩放锐度
  const fxaa = new THREE.ShaderPass(THREE.FXAAShader);
  if (renderer.getPixelRatio() >= 1.5) fxaa.enabled = false;
  const setFXAAResolution = () => {
    const dpr = renderer.getPixelRatio();
    fxaa.material.uniforms['resolution'].value.set(
      1 / (window.innerWidth * dpr), 1 / (window.innerHeight * dpr));
  };
  setFXAAResolution();
  composer.addPass(fxaa);

  return {
    composer, bloom, ssao, fxaa,
    setSize(w, h) {
      composer.setSize(w, h);
      setFXAAResolution();
    },
  };
};
