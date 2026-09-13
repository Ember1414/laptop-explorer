/* ============================================================
 * sceneManager.js — 场景管理器(组合根/入口)
 * 职责:渲染器与场景装配、节点栈导航、纪录片式相机运镜、
 *       模型懒加载与 dispose、悬停高亮、点击进入子节点、
 *       键盘按压反馈、主循环。
 *
 * 部件入口规则:当前模型里 name === child.id 的 Object3D 即入口
 * (hover 高亮 + 点击进入);找不到时回退为发光球占位。
 * 视觉标准见 QUALITY_BASELINE.md。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 渲染器:PBR + PCFSoft 阴影 + ACES 色调映射 ---------- */
  const container = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  container.appendChild(renderer.domElement);
  LX.renderer = renderer; // core/lighting 需要

  const scene = new THREE.Scene();
  // 后处理含 GammaCorrection 线性→sRGB,背景/雾需先转到线性色,否则整体发灰
  scene.background = new THREE.Color(0x0d1117).convertSRGBToLinear();
  scene.fog = new THREE.Fog(scene.background, 30, 80);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 200);
  camera.position.set(7.4, 6.4, 10.2);

  /* ---------- 舞台:光照/环境/地面 与 后处理管线 与 交互控制 ---------- */
  LX.lighting.setup(scene);
  const post = LX.post.create(renderer, scene, camera);
  const controls = LX.createControls(camera, renderer.domElement);

  /* ---------- 极简补间引擎(按墙钟时间推进,掉帧不拖长过渡) ---------- */
  const tweens = [];
  function addTween({ duration, ease = LX.Ease.inOutCubic, onUpdate, onComplete }) {
    const tw = { t: 0, duration, ease, onUpdate, onComplete, dead: false };
    tweens.push(tw);
    return tw;
  }
  function updateTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.dead) { tweens.splice(i, 1); continue; }
      tw.t += dt;
      const k = Math.min(tw.t / tw.duration, 1);
      tw.onUpdate && tw.onUpdate(tw.ease(k), k);
      if (k >= 1) {
        tweens.splice(i, 1);
        tw.onComplete && tw.onComplete();
      }
    }
  }

  /**
   * 相机飞行:position 走二次贝塞尔(可选弧线抬升),target 线性补间。
   * arcLift > 0 时镜头先抬起再落下,模拟纪录片运镜(基线 10)。
   */
  function flyCamera(toPos, toTarget, duration, ease, onComplete, arcLift = 0) {
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    const mid = p0.clone().add(toPos).multiplyScalar(0.5);
    mid.y += arcLift;
    addTween({
      duration, ease, onComplete,
      onUpdate: (e) => {
        const a = (1 - e) * (1 - e), b = 2 * e * (1 - e), c = e * e;
        camera.position.set(
          a * p0.x + b * mid.x + c * toPos.x,
          a * p0.y + b * mid.y + c * toPos.y,
          a * p0.z + b * mid.z + c * toPos.z);
        controls.target.lerpVectors(t0, toTarget, e);
      },
    });
  }

  /* ---------- 场景管理器状态 ---------- */
  const ACCENT = 0x4cc2ff;
  const HOVER = 0xffe066;

  const mgr = {
    stack: [SCENE_TREE],
    currentGroup: null,
    proxies: [],
    hovered: null,
    hoverBox: null,
    emissiveBackup: new WeakMap(),
    transitioning: false,
    modelTime: 0,           // 当前模型构建后的累计秒数(驱动 tick 入场动画)
    pointer: new THREE.Vector2(-10, -10),
    raycaster: new THREE.Raycaster(),
    downPos: null,
    downOnKey: false,       // 按下的是键帽时,松开不触发"进入子节点"
    clock: new THREE.Clock(),
  };

  let fpsFrames = 0, fpsTime = 0, qualityChecked = false;

  /* ----- 模型构建与释放(懒加载,需求 4) ----- */
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function buildNode(node) {
    try {
      const group = node.model();
      group.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          // RoomEnvironment 偏亮,统一压低环境反射强度,避免过曝
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if ('envMapIntensity' in m) m.envMapIntensity = 0.35;
            // 纹理全开各向异性过滤:消除斜视/放大时的贴图模糊
            for (const k in m) {
              const v = m[k];
              if (v && v.isTexture) { v.anisotropy = maxAniso; v.needsUpdate = true; }
            }
          });
        }
      });
      scene.add(group);
      mgr.modelTime = 0;
      return group;
    } catch (e) {
      // 构建失败绝不冻结交互:记录错误(控制台 window.__errs 可查)并返回空组
      window.__errs = window.__errs || [];
      if (window.__errs.length < 20) window.__errs.push('BUILD:' + ((e && e.stack) || e).toString().slice(0, 300));
      const fallback = new THREE.Group();
      scene.add(fallback);
      mgr.modelTime = 0;
      return fallback;
    }
  }

  function disposeGroup(group) {
    group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose(); // 释放实例矩阵缓冲
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          for (const k in m) {
            const v = m[k];
            if (v && v.isTexture) v.dispose();
          }
          m.dispose();
        });
      }
    });
    scene.remove(group);
  }

  /* ----- 键盘按压反馈(契约:group.userData.keys) ----- */
  function pressKey(keyMesh) {
    if (keyMesh.userData.pressing) return;
    keyMesh.userData.pressing = true;
    if (keyMesh.userData.keyId && LX.onKeyPress) LX.onKeyPress(keyMesh.userData.keyId);
    const y0 = keyMesh.userData.baseY;
    addTween({
      duration: 0.09, ease: LX.Ease.inCubic,
      onUpdate: (e) => { keyMesh.position.y = y0 - 0.005 * e; },
      onComplete: () => addTween({
        duration: 0.16, ease: LX.Ease.outCubic,
        onUpdate: (e) => { keyMesh.position.y = y0 - 0.005 * (1 - e); },
        onComplete: () => { keyMesh.userData.pressing = false; },
      }),
    });
  }

  /* ----- 入口(子节点点击目标) ----- */
  // 入口精确包围盒:仅统计真实网格(排除 Sprite 标签等视差元素),
  // 保证悬停区域与可见几何一致 —— "指哪判哪"
  function preciseMeshBox(obj) {
    const box = new THREE.Box3();
    let has = false;
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      if (!has) { box.copy(b); has = true; } else box.union(b);
    });
    return has ? box : new THREE.Box3().setFromObject(obj);
  }

  function buildProxies(node) {
    clearProxies();
    for (const child of node.children) {
      const marker = mgr.currentGroup.getObjectByName(child.id);
      if (marker) {
        marker.userData.childNode = child;
        marker.userData.isMarker = true;
        mgr.proxies.push(marker);
        // 组入口的包围盒中心可能落在元件之间的空隙(射线会漏检),
        // 加一个不可见命中盒让"点击部件区域任意位置"生效;尺寸取精确包围盒(不再膨胀)
        const box = preciseMeshBox(marker);
        const size = box.getSize(new THREE.Vector3());
        if (size.lengthSq() > 0) {
          const worldCenter = box.getCenter(new THREE.Vector3());
          const inv = new THREE.Matrix4().copy(marker.matrixWorld).invert();
          const localCenter = worldCenter.applyMatrix4(inv);
          const hit = new THREE.Mesh(
            new THREE.BoxGeometry(
              Math.max(size.x, 0.02), Math.max(size.y, 0.02), Math.max(size.z, 0.02)),
            new THREE.MeshBasicMaterial({ visible: false })
          );
          hit.position.copy(localCenter);
          const ws = marker.getWorldScale(new THREE.Vector3());
          hit.geometry.scale(1 / ws.x, 1 / ws.y, 1 / ws.z);
          hit.userData.isHitbox = true;
          marker.add(hit);
        }
        continue;
      }
      // 回退:精确落点的地面光环标记(不再使用大球)
      const cfg = child.proxy || {};
      const size = cfg.size || Math.min(Math.max(child.cameraDistance * 0.28, 0.22), 0.3);
      const idx = mgr.proxies.length;
      const spread = Math.max(node.children.length, 1);
      const p = new THREE.Group();
      p.position.set(...(cfg.position || [(idx - (spread - 1) / 2) * 0.75, 0.02, 0.9]));
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(size * 0.9, size * 0.09, 10, 40),
        new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.14, size * 0.14, 1.0, 10),
        new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
      core.position.y = 0.5;
      const labCv = document.createElement('canvas');
      labCv.width = 256; labCv.height = 64;
      const lcg = labCv.getContext('2d');
      lcg.font = 'bold 30px "Microsoft YaHei", monospace';
      lcg.textAlign = 'center';
      lcg.fillStyle = '#8fd4ff';
      lcg.fillText(child.label.slice(0, 12), 128, 42);
      const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labCv), transparent: true, depthWrite: false, depthTest: false }));
      lab.renderOrder = 10;
      lab.scale.set(1.1, 0.275, 1);
      lab.position.y = 1.15;
      p.add(ring, core, lab);
      p.userData = { childNode: child, wire: ring, core, hoverAmt: 0, isMarker: false };
      mgr.currentGroup.add(p);
      mgr.proxies.push(p);
    }
  }

  function removeHoverBox() {
    if (mgr.hoverBox) {
      scene.remove(mgr.hoverBox);
      mgr.hoverBox.geometry.dispose();
      mgr.hoverBox.material.dispose();
      mgr.hoverBox = null;
    }
  }

  function setEmissive(root, hex) {
    root.traverse((o) => {
      if (!o.material || !o.material.emissive) return;
      if (o.material.userData && o.material.userData.noTint) return; // 字符等标记材质不参与悬停染色
      if (hex === null) {
        const orig = mgr.emissiveBackup.get(o.material);
        if (orig !== undefined) o.material.emissive.setHex(orig);
        mgr.emissiveBackup.delete(o.material);
      } else {
        if (!mgr.emissiveBackup.has(o.material)) mgr.emissiveBackup.set(o.material, o.material.emissive.getHex());
        o.material.emissive.setHex(hex);
      }
    });
  }

  function setHovered(p) {
    if (mgr.hovered === p) return;
    if (mgr.hovered) {
      if (mgr.hovered.userData.isMarker) setEmissive(mgr.hovered, null);
      else mgr.hovered.userData.wire.material.color.setHex(ACCENT);
    }
    removeHoverBox();
    mgr.hovered = p;
    if (p) {
      if (p.userData.isMarker) {
        setEmissive(p, 0x0f4a66);
        mgr.hoverBox = new THREE.BoxHelper(p, HOVER);
        scene.add(mgr.hoverBox);
      } else {
        p.userData.wire.material.color.setHex(HOVER);
      }
      LX.ui.infoPanel.setHint('↳ 点击进入:' + p.userData.childNode.label);
      renderer.domElement.style.cursor = 'pointer';
    } else {
      LX.ui.infoPanel.setHint('');
      renderer.domElement.style.cursor = '';
    }
  }

  function clearProxies() {
    setHovered(null);
    mgr.proxies.length = 0;
    removeHoverBox();
  }

  /* ----- 面包屑 / 信息面板 / 节点专属 UI ----- */
  const breadcrumbEl = document.getElementById('breadcrumb');

  function renderPanel(node) {
    LX.ui.infoPanel.render(node);
    toggleOverlays(node);
  }

  /* ----- 模块导航栏:全树目录,点击任意模块直接跳转(快速teleport,不逐级运镜) ----- */
  function findPath(id) {
    let found = null;
    (function walk(node, path) {
      if (found) return;
      path.push(node);
      if (node.id === id) { found = path.slice(); return; }
      for (const c of node.children) walk(c, path);
      path.pop();
    })(mgr.stack[0], []);
    return found;
  }
  LX.navigateTo = (id) => {
    if (mgr.transitioning) return;
    const idx = mgr.stack.findIndex((n) => n.id === id);
    if (idx >= 0) { jumpTo(idx); return; } // 已在当前链上:普通返回即可
    const path = findPath(id);
    if (!path) return;
    setHovered(null);
    clearProxies();
    disposeGroup(mgr.currentGroup);
    mgr.stack = path;
    const target = path[path.length - 1];
    mgr.currentGroup = buildNode(target);
    const f = framingFor(target);
    camera.position.copy(f.pos);
    controls.target.copy(f.target);
    controls.update();
    mgr.currentGroup.scale.setScalar(0.6);
    buildProxies(target);
    renderBreadcrumb();
    renderPanel(target);
    addTween({
      duration: 0.45, ease: LX.Ease.outCubic,
      onUpdate: (e) => { if (mgr.currentGroup) mgr.currentGroup.scale.setScalar(0.6 + 0.4 * e); },
      onComplete: () => { if (pcPending) { pcPending = false; enterPC(); } },
    });
  };
  function renderNav() {
    const el = document.getElementById('nav-tree');
    if (!el) return;
    const cur = mgr.stack[mgr.stack.length - 1].id;
    el.innerHTML = '';
    (function walk(node, depth) {
      const d = document.createElement('div');
      d.className = 'nav-item' + (node.id === cur ? ' active' : '');
      d.style.paddingLeft = (10 + depth * 13) + 'px';
      d.textContent = node.label;
      d.addEventListener('click', () => { if (node.id !== cur) LX.navigateTo(node.id); });
      el.appendChild(d);
      node.children.forEach((c) => walk(c, depth + 1));
    })(mgr.stack[0], 0);
  }

  function renderBreadcrumb() {
    LX.ui.breadcrumb.render(breadcrumbEl, mgr.stack, jumpTo);
    const d = document.createElement('span');
    d.style.cssText = 'margin-left:10px;color:#5a6572;font-size:11px;white-space:nowrap';
    d.textContent = `层级 ${mgr.stack.length}`;
    breadcrumbEl.appendChild(d);
    renderNav();
  }

  function toggleOverlays(node) {
    document.querySelectorAll('.overlay-panel').forEach((p) => {
      p.style.display = p.dataset.node === node.id ? '' : 'none';
    });
  }

  /* ----- 跟随镜头(汇编运行时跟随活跃数据胶囊) ----- */
  const followTmp = new THREE.Vector3();
  const followDir = new THREE.Vector3();
  const FOLLOW_DIST = 2.4;
  function updateFollow(dt) {
    if (!mgr.followObj) return;
    mgr.followObj.getWorldPosition(followTmp);
    controls.target.lerp(followTmp, Math.min(dt * 4.5, 1));
    // 保持固定跟随距离:沿当前视线方向把相机稳定在目标外 2.4 个单位
    followDir.copy(camera.position).sub(controls.target);
    const d = followDir.length() || 1;
    camera.position.copy(controls.target).addScaledVector(followDir.divideScalar(d), FOLLOW_DIST);
    // 抬高俯视分量:避免镜头贴着流水线隧道平视穿模
    const wantY = controls.target.y + 1.05;
    camera.position.y += (wantY - camera.position.y) * Math.min(dt * 3, 1);
  }

  function refreshGrid() { /* 网格已移除:保留空实现兼容调用点 */ }

  /* ----- 导航(纪录片式运镜) ----- */
  function framingFor(node, fromDir) {
    const dir = fromDir || camera.position.clone().sub(controls.target).normalize();
    // 竖屏/窄屏视锥横向窄:拉远取景,避免机身左右(键盘两端)被裁掉
    const fit = window.innerWidth / window.innerHeight < 1 ? 1.4 : 1;
    return {
      pos: dir.clone().multiplyScalar(node.cameraDistance * fit),
      target: new THREE.Vector3(0, 0, 0),
    };
  }

  /** 进入子节点:拉远看整体 → 俯冲入口 → 构建子模型 → 推进取景 */
  function enterChild(proxy) {
    if (mgr.transitioning) return;
    const child = proxy.userData.childNode;
    if (!child) return;

    mgr.transitioning = true;
    controls.enabled = false;
    setHovered(null);

    const startDist = camera.position.distanceTo(controls.target);

    // 第一段:拉远看清整体
    const awayDir = camera.position.clone().sub(controls.target).normalize();
    const pullPos = controls.target.clone().add(awayDir.clone().multiplyScalar(startDist * 1.45));
    flyCamera(pullPos, controls.target.clone(), 0.45, LX.Ease.outCubic, () => {
      // 第二段:俯冲到入口前方(部件入口取包围盒中心)
      const diveTarget = proxy.userData.isMarker
        ? preciseMeshBox(proxy).getCenter(new THREE.Vector3())
        : proxy.getWorldPosition(new THREE.Vector3());
      const diveDir = diveTarget.clone().sub(camera.position).normalize();
      const divePos = diveTarget.clone().sub(diveDir.multiplyScalar(child.cameraDistance * 0.5));
      flyCamera(divePos, diveTarget, 0.55, LX.Ease.inCubic, () => {
        // 交换模型:释放父模型,懒构建子模型
        disposeGroup(mgr.currentGroup);
        clearProxies();
        mgr.stack.push(child);
        mgr.currentGroup = buildNode(child);
        mgr.currentGroup.scale.setScalar(0.5);
        renderBreadcrumb();
        renderPanel(child);
        refreshGrid();

        // 第三段:推进到子节点取景,子模型舒展
        const f = framingFor(child);
        flyCamera(f.pos, f.target, 0.9, LX.Ease.outCubic, () => {
          buildProxies(child);
          mgr.transitioning = false;
          controls.enabled = true;
        }, startDist * 0.12);
        addTween({
          duration: 0.9, ease: LX.Ease.outCubic,
          onUpdate: (e) => mgr.currentGroup.scale.setScalar(0.5 + 0.5 * e),
        });
      });
      addTween({
        duration: 0.55, ease: LX.Ease.inCubic,
        onUpdate: (e) => mgr.currentGroup.scale.setScalar(1 - 0.4 * e),
      });
    });
  }

  /** 返回上层(可跨多级):构建祖先模型 → 弧线拉远 → 释放当前模型 */
  function jumpTo(index) {
    if (mgr.transitioning || index >= mgr.stack.length - 1) return;
    mgr.transitioning = true;
    controls.enabled = false;
    setHovered(null);

    const toNode = mgr.stack[index];
    const toGroup = buildNode(toNode); // 目标模型立刻构建,"从内部退出来"
    mgr.stack = mgr.stack.slice(0, index + 1);
    mgr.followObj = null; // 离开节点即解除跟随

    const dir = camera.position.clone().sub(controls.target).normalize();
    const f = framingFor(toNode, dir);
    const dist = camera.position.distanceTo(controls.target);
    flyCamera(f.pos, f.target, 1.15, LX.Ease.inOutCubic, () => {
      disposeGroup(mgr.currentGroup);
      mgr.currentGroup = toGroup;
      buildProxies(toNode);
      mgr.transitioning = false;
      controls.enabled = true;
      renderBreadcrumb();
      renderPanel(toNode);
      refreshGrid();
    }, Math.max(dist * 0.25, 0.5)); // 弧线抬升,像从内部抽身出来

    const fromGroup = mgr.currentGroup;
    addTween({
      duration: 1.15, ease: LX.Ease.inOutCubic,
      onUpdate: (e) => fromGroup.scale.setScalar(Math.max(1 - e * 1.2, 0.001)),
    });
  }

  function goBack() {
    if (mgr.stack.length > 1) jumpTo(mgr.stack.length - 2);
  }

  /* ----- 拾取 ----- */
  function pickProxy() {
    try {
      pickProxyInner();
    } catch (err) {
      window.__errs = window.__errs || [];
      if (window.__errs.length < 20) window.__errs.push('PICK:' + ((err && err.message) || err).toString().slice(0, 200));
    }
  }
  function pickProxyInner() {
    if (mgr.transitioning) { setHovered(null); return; }
    mgr.raycaster.setFromCamera(mgr.pointer, camera);

    // 键帽优先:悬停键帽时给出按压提示,不触发"进入机身"
    const keys = mgr.currentGroup && mgr.currentGroup.userData.keys;
    if (keys && keys.length) {
      const keyHit = mgr.raycaster.intersectObjects(keys)[0];
      if (keyHit) {
        setHovered(null);
        LX.ui.infoPanel.setHint('⌨ 点击按键试试');
        renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }

    if (mgr.proxies.length === 0) { setHovered(null); return; }
    const hits = mgr.raycaster.intersectObjects(mgr.proxies, true);
    if (hits.length) {
      // 精度优先:真实网格命中 > 隐形命中盒(命中盒只补空隙);
      // 同类中体积小者(更"具体")优先,体积相同取最近 —— 固定位置悬停判定准确
      const resolve = (h) => { let o = h.object; while (o && !o.userData.childNode) o = o.parent; return o; };
      let best = null, bestVol = Infinity, bestDist = Infinity;
      let hb = null, hbVol = Infinity, hbDist = Infinity;
      for (const h of hits) {
        const o = resolve(h);
        if (!o) continue;
        const size = preciseMeshBox(o).getSize(new THREE.Vector3());
        const vol = Math.max(size.x * size.y * size.z, 1e-9);
        if (h.object.userData.isHitbox === true) {
          if (vol < hbVol - 1e-9 || (Math.abs(vol - hbVol) < 1e-9 && h.distance < hbDist)) {
            hbVol = vol; hbDist = h.distance; hb = o;
          }
        } else if (vol < bestVol - 1e-9 || (Math.abs(vol - bestVol) < 1e-9 && h.distance < bestDist)) {
          bestVol = vol; bestDist = h.distance; best = o;
        }
      }
      setHovered(best || hb);
    } else {
      setHovered(null);
    }
  }

  renderer.domElement.addEventListener('pointermove', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    mgr.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mgr.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    if (pcMode) {
      // 真实鼠标移动 = 模拟电脑光标移动(屏幕直控 / 触控板平面映射)
      const uv = pcComputeUV();
      if (uv && LX.osMove) LX.osMove(uv.x, uv.y);
      return;
    }
    pickProxy();
  });

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (pcMode) {
      // 电脑模式下 3D 键盘仍可敲击输入(与真实笔记本一致)
      const r = renderer.domElement.getBoundingClientRect();
      mgr.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mgr.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      const keys = mgr.currentGroup && mgr.currentGroup.userData.keys;
      if (keys && keys.length) {
        mgr.raycaster.setFromCamera(mgr.pointer, camera);
        const kh = mgr.raycaster.intersectObjects(keys)[0];
        if (kh) { pressKey(kh.object); return; }
      }
      return; // 其余点击交给 pointerup(屏幕/触控板)
    }
    mgr.downPos = [e.clientX, e.clientY];
    mgr.downOnKey = false;
    if (mgr.transitioning) return;
    // 命中键帽 → 按压反馈
    const keys = mgr.currentGroup && mgr.currentGroup.userData.keys;
    if (keys && keys.length) {
      const r = renderer.domElement.getBoundingClientRect();
      mgr.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mgr.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      mgr.raycaster.setFromCamera(mgr.pointer, camera);
      const keyHit = mgr.raycaster.intersectObjects(keys)[0];
      if (keyHit) {
        mgr.downOnKey = true;
        pressKey(keyHit.object);
      }
    }
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!mgr.downPos) return;
    const dx = e.clientX - mgr.downPos[0];
    const dy = e.clientY - mgr.downPos[1];
    mgr.downPos = null;
    if (dx * dx + dy * dy > 25) return; // 拖拽不算点击
    if (mgr.downOnKey) return;          // 键帽按压不触发进入
    if (pcMode) {
      const uv = pcComputeUV(); // 松开时重算:屏幕直点或触控板点击都生效
      if (uv && LX.osClick) LX.osClick(uv.x, uv.y);
      return;
    }
    if (!mgr.hovered && !mgr.transitioning) {
      // 触屏点按没有 hover 过程:松开时按点按坐标补一次拾取(修手机点部件无反应)
      const r = renderer.domElement.getBoundingClientRect();
      mgr.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mgr.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      pickProxy();
    }
    if (mgr.hovered && !mgr.transitioning) enterChild(mgr.hovered);
  });

  /* ----- 电脑模式(P 键:坐姿全景 —— 屏幕+键盘+触控板同框,键/触控板/屏幕都能操作) ----- */
  let pcMode = false, pcPending = false, pcSaved = null, osUV = null;
  const screenMeshOf = () => {
    const s = mgr.currentGroup && mgr.currentGroup.getObjectByName('screen');
    return s ? s.children[0] : null;
  };
  const touchpadMeshOf = () => {
    const grp = mgr.currentGroup && mgr.currentGroup.getObjectByName('touchpad');
    if (!grp) return null;
    let mesh = null;
    grp.traverse((o) => { if (!mesh && o.isMesh && o.userData.isHitbox !== true) mesh = o; });
    return mesh;
  };
  // 计算桌面坐标:屏幕直控;触控板平面线性映射到整块桌面(真实笔记本交互)
  function pcComputeUV() {
    mgr.raycaster.setFromCamera(mgr.pointer, camera);
    const sm = screenMeshOf();
    if (sm) {
      const h = mgr.raycaster.intersectObject(sm, false)[0];
      if (h && h.uv) { osUV = { x: h.uv.x * 1024, y: (1 - h.uv.y) * 640 }; return osUV; }
    }
    const pm = touchpadMeshOf();
    if (pm) {
      const h = mgr.raycaster.intersectObject(pm, false)[0];
      if (h) {
        const bb = new THREE.Box3().setFromObject(pm);
        const nx = THREE.MathUtils.clamp((h.point.x - bb.min.x) / Math.max(bb.max.x - bb.min.x, 1e-6), 0, 1);
        const nz = THREE.MathUtils.clamp((h.point.z - bb.min.z) / Math.max(bb.max.z - bb.min.z, 1e-6), 0, 1);
        // 触控板映射:pad 远端(-z,靠屏幕)= 桌面顶部(nz 小 → y 小)——方向与真机一致
        osUV = { x: nx * 1024, y: nz * 640 };
        return osUV;
      }
    }
    return null;
  }
  function enterPC() {
    pcSaved = { pos: camera.position.clone(), tgt: controls.target.clone() };
    controls.enabled = false;
    // 坐姿全景:屏幕(可读)+ 键盘(可敲)+ 触控板(可划)全部在视野内;
    // 飞行 1.6s 与开盖动画重叠,落定时屏幕已立起,raycast 稳定
    flyCamera(new THREE.Vector3(0, 2.5, 4.3), new THREE.Vector3(0, 0.62, 0.05), 1.6, LX.Ease.inOutCubic, () => {
      pcMode = true;
      document.body.classList.add('pc-mode'); // 隐藏全部 UI,只看模拟屏幕
      if (LX.osPC) LX.osPC(true); // 屏幕顶部绿色横幅自证:模式已激活
    });
  }
  LX.togglePC = () => {
    if (pcMode) {
      pcMode = false;
      osUV = null;
      document.body.classList.remove('pc-mode');
      if (LX.osPC) LX.osPC(false);
      controls.enabled = true;
      flyCamera(pcSaved.pos, pcSaved.tgt, 1.0, LX.Ease.inOutCubic);
    } else if (mgr.stack.length > 1) {
      pcPending = true;
      LX.navigateTo('laptop'); // 在子节点按 P:先自动回到整机,再进入电脑模式
    } else {
      enterPC();
    }
  };

  /* ----- 学习站快捷键与导览/画质/截图 ----- */
  let tourOn = false, tourTimer = 0;
  function tourStep() {
    if (!tourOn) return;
    if (mgr.transitioning) { tourTimer = setTimeout(tourStep, 1200); return; }
    const node = mgr.stack[mgr.stack.length - 1];
    const visited = node._tourVisited || (node._tourVisited = new Set());
    const next = node.children.find((c) => !visited.has(c.id));
    if (next) {
      visited.add(next.id);
      const proxy = mgr.proxies.find((p) => p.userData.childNode === next);
      if (proxy) enterChild(proxy);
      tourTimer = setTimeout(tourStep, 7000);
    } else if (mgr.stack.length > 1) {
      goBack();
      tourTimer = setTimeout(tourStep, 4500);
    } else {
      node._tourVisited = new Set(); // 回到根:清空已访集,循环导览
      tourTimer = setTimeout(tourStep, 6000);
    }
  }
  LX.toggleTour = (on) => {
    tourOn = !!on;
    clearTimeout(tourTimer);
    if (tourOn) tourStep();
    const b = document.getElementById('tour-btn');
    if (b) b.textContent = tourOn ? '⏹ 停止导览' : '🎬 自动导览';
  };

  const QUALITY = [
    { name: '高', pixelRatio: Math.min(window.devicePixelRatio, 2), ssao: true },
    { name: '中', pixelRatio: 1.5, ssao: true },
    { name: '低', pixelRatio: 1, ssao: false },
  ];
  let qIdx = 0;
  LX.setQuality = (i) => {
    qIdx = ((i % 3) + 3) % 3;
    const q = QUALITY[qIdx];
    renderer.setPixelRatio(q.pixelRatio);
    post.ssao.enabled = q.ssao;
    post.setSize(window.innerWidth, window.innerHeight);
    const b = document.getElementById('quality-btn');
    if (b) b.textContent = '⚡ 画质:' + q.name;
  };

  LX.screenshot = () => {
    post.composer.render(); // 同步渲染当前帧后立即取像素
    renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'laptop-explorer-' + Date.now() + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  };

  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    // WASD/QE 平移视角(相机坐标系;电脑模式下这些键交给打字)
    const k = e.key.toLowerCase();
    if (!pcMode && ['w', 'a', 's', 'd', 'q', 'e'].includes(k)) {
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
      fwd.normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const mv = new THREE.Vector3();
      if (k === 'w') mv.add(fwd);
      if (k === 's') mv.sub(fwd);
      if (k === 'a') mv.add(right);
      if (k === 'd') mv.sub(right);
      if (k === 'e') mv.y += 1;
      if (k === 'q') mv.y -= 1;
      const dist = camera.position.distanceTo(controls.target);
      mv.normalize().multiplyScalar(Math.max(dist * 0.12, 0.05));
      camera.position.add(mv);
      controls.target.add(mv);
      return;
    }
    if (pcMode) {
      // 电脑模式:真实键盘直接输入模拟电脑
      if (e.key === 'Escape') { LX.togglePC(); return; }
      if (e.key === 'Backspace') LX.onKeyPress('back');
      else if (e.key === 'Enter') LX.onKeyPress('enter');
      else if (e.key === ' ') LX.onKeyPress('space');
      else if (e.key.length === 1) LX.onKeyPress(e.key.toLowerCase());
      return;
    }
    if (e.key === 'p' || e.key === 'P') { LX.togglePC(); return; }
    if (e.key === 'Escape') {
      if (tourOn) LX.toggleTour(false);
      mgr.followObj = null;
      goBack();
      return;
    }
    if (mgr.transitioning) return;
    const node = mgr.stack[mgr.stack.length - 1];
    const parent = mgr.stack[mgr.stack.length - 2];
    if (e.key === 'ArrowUp' && mgr.stack.length > 1) { goBack(); return; }
    if (e.key === 'ArrowDown' && node.children.length && mgr.proxies.length) {
      enterChild(mgr.proxies[0]);
      return;
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && parent) {
      const idx = parent.children.indexOf(node);
      const n = parent.children.length;
      const next = parent.children[(idx + (e.key === 'ArrowRight' ? 1 : n - 1)) % n];
      const proxy = mgr.proxies.find((p) => p.userData.childNode === next);
      if (proxy) enterChild(proxy);
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    post.setSize(window.innerWidth, window.innerHeight);
  });

  /* ----- 主循环 ----- */
  function animate() {
    requestAnimationFrame(animate);
    const rawDt = Math.min(mgr.clock.getDelta(), 0.25);
    const dt = Math.min(rawDt, 0.05); // 逐帧逻辑钳制,防止切后台跳变
    const t = mgr.clock.elapsedTime;

    updateTweens(rawDt); // 补间按墙钟时间推进,面板掉帧时过渡也能按时结束

    // 运行错误角标:任何被捕获的异常都在提示栏红字显示,便于立刻发现
    if ((mgr.errTick = (mgr.errTick || 0) + 1) % 60 === 0) {
      const n = (window.__errs && window.__errs.length) || 0;
      const he = document.getElementById('hint-err');
      if (he) he.textContent = n ? ` · ⚠ 运行异常×${n}(控制台可见)` : '';
    }

    // 跟随镜头:视角目标平滑追踪活跃数据胶囊
    updateFollow(rawDt);

    // 当前节点:tick(模型内部入场动画,按墙钟推进)+ simulate(节点级逻辑,钳制 dt)
    const node = mgr.stack[mgr.stack.length - 1];
    if (mgr.currentGroup) {
      mgr.modelTime += rawDt;
      try {
        if (mgr.currentGroup.userData.tick) mgr.currentGroup.userData.tick(rawDt, mgr.modelTime);
        if (node.simulate) node.simulate(dt, mgr.currentGroup);
      } catch (e) {
        window.__errs = window.__errs || [];
        if (window.__errs.length < 20) window.__errs.push('TICK:' + ((e && e.message) || e).toString().slice(0, 200));
      }
    }

    // 发光球入口呼吸(部件入口无此效果)
    for (const p of mgr.proxies) {
      if (p.userData.isMarker) continue;
      const u = p.userData;
      u.hoverAmt += ((mgr.hovered === p ? 1 : 0) - u.hoverAmt) * Math.min(dt * 10, 1);
      const pulse = 1 + Math.sin(t * 2.5) * 0.06;
      p.scale.setScalar(pulse * (1 + u.hoverAmt * 0.35));
      u.core.material.opacity = 0.22 + u.hoverAmt * 0.3;
    }
    if (!qualityChecked) {
      fpsFrames += 1;
      fpsTime += rawDt;
      if (fpsTime >= 2) {
        qualityChecked = true;
        const fps = fpsFrames / fpsTime;
        if (fps < 30) { // 低帧率环境(节流面板/低端设备):动态降级,保交互流畅
          post.ssao.enabled = false;
          renderer.setPixelRatio(1);
          post.setSize(window.innerWidth, window.innerHeight);
        }
      }
    }
    if (!mgr.transitioning) pickProxy();

    controls.update();
    post.composer.render();
  }

  /* ----- 启动 ----- */
  mgr.currentGroup = buildNode(SCENE_TREE);
  buildProxies(SCENE_TREE);
  renderBreadcrumb();
  renderPanel(SCENE_TREE);
  refreshGrid();
  animate();

  // 跟随镜头 API(流水线等节点驱动)
  LX.follow = {
    set(obj) { mgr.followObj = obj; },
    clear() { mgr.followObj = null; },
  };

  // 顶栏按钮接线
  const tb = document.getElementById('tour-btn');
  if (tb) tb.addEventListener('click', () => LX.toggleTour(!tourOn));
  const nb = document.getElementById('nav-btn');
  if (nb) nb.addEventListener('click', () => {
    const p = document.getElementById('nav-panel');
    const on = p.style.display !== 'block';
    p.style.display = on ? 'block' : 'none';
    nb.textContent = on ? '✕ 关闭导航' : '☰ 模块导航';
  });
  const qb = document.getElementById('quality-btn');
  if (qb) qb.addEventListener('click', () => LX.setQuality(qIdx + 1));
  const sb = document.getElementById('shot-btn');
  if (sb) sb.addEventListener('click', () => LX.screenshot());
  const pcb = document.getElementById('pc-btn');
  if (pcb) pcb.addEventListener('click', () => LX.togglePC());

  // 移动端适配:触屏/小屏默认低画质保帧率(可手动切回),并切换底部提示条
  const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (isTouch || window.innerWidth < 720) {
    LX.setQuality(2);
    const ht = document.getElementById('hint-touch');
    const hb = document.getElementById('hint-bar');
    if (ht) ht.style.display = 'block';
    if (hb) hb.style.display = 'none';
  }

  // 调试出口(控制台可用)
  window.__mgr = mgr;
  window.__cam = camera;
  window.__controls = controls;
  window.__animate = animate; // 供测试钩子在 RAF 被宿主节流时手动泵帧
})();
