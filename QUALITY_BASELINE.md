# 视觉质量基线(每个阶段必须遵守)

> 适用范围:所有阶段(含内部原理演示)。原理性抽象(如用小球表示电子)允许,
> 但小球自身的材质/发光/轨迹必须与外观模型同一水准;性能不足用 LOD/动态降级,
> 不允许从一开始就降低视觉标准。

## 〇、几何建模铁律(优先级最高,覆盖一切"先跑通后精修"的习惯)

1. **一次到位**:任何新部件的几何建模必须直接达到目标质感。禁止先用基础几何体
   (BoxGeometry/CylinderGeometry)堆砌占位、打算"以后回来精修"。
2. **外壳/结构禁直角**:统一 `RoundedBoxGeometry` 或自定义倒角;截面不均匀的部件
   (如笔记本前薄后厚的楔形机身)用 `ExtrudeGeometry` 沿自定义轮廓路径挤出。
3. **挖孔/凹槽必须真实**:接口、按键井、Logo、防爆槽等用布尔运算实际挖出。
   本项目无构建环境,棱柱类开孔统一用 `Shape.holes + ExtrudeGeometry` 实现
   (等效布尔,壁厚方向为棱柱轴);复杂曲面件再引入 CSG 库。禁止深色贴面假装凹槽。
4. **密集重复小件用 InstancedMesh**:贴片元件、内存颗粒、螺丝群等批量渲染,
   且每个实例带轻微随机位置/角度扰动(种子随机,保证可复现),禁止完全整齐排列。
5. **特写验收(硬性门槛)**:部件完成后,把相机拉到贴近该部件的特写距离检查轮廓与
   材质细节——全景视角会掩盖方块感,特写才是验收标准。特写不过关 = 该阶段未完成,
   不得进入下一阶段。
6. **材质跟上几何精度**:拼接处留可见细缝(分型线)、金属件加方向性拉丝纹理
   (roughness/bump 贴图)、塑料件加轻微磨砂颗粒;禁止"没有历史感"的全新光滑塑料面。
7. **为什么**:占位几何后期返工会改变包围盒,牵连已调好的相机机位与节点参数,
   造成大规模重做。阶段离开前把几何/材质做到位是成本最低的时机。

## 一、光照与材质

1. **PBR 材质**:只用 `MeshStandardMaterial` / `MeshPhysicalMaterial`。
   金属件(散热片、转轴、接口屏蔽壳)必须给出合理的 `metalness`/`roughness`
   (参考:铝壳 metalness≈0.85/roughness≈0.4,铜 metalness≈0.9/roughness≈0.25,
   橡胶 metalness=0/roughness≥0.9)。
2. **三点布光 + 环境贴图**:主光源(方向光)+ 补光(压暗部)+ 轮廓光(勾边缘);
   环境反射用 PMREMGenerator + RoomEnvironment 程序化生成(`scene.environment`),
   后续如需更真实可换 RGBELoader 加载免费工作室 HDRI,二选一即可,不允许没有环境贴图。
3. **阴影**:开启 `renderer.shadowMap`,类型 `PCFSoftShadowMap`;主光源 `castShadow`,
   网格模型 `castShadow/receiveShadow`,地面用 `ShadowMaterial` 接影。禁止硬阴影默认值裸奔。
4. **自发光 + Bloom**:屏幕、指示灯、电子等发光体用 `emissive`(可配 emissiveMap),
   后处理 `UnrealBloomPass` 提供光晕。禁止用纯色 MeshBasicMaterial 冒充发光。
5. **后处理管线**:`EffectComposer` 至少包含 轻微 SSAO(缝隙层次)+
   ACESFilmicToneMapping(色调映射)+ FXAA(抗锯齿)+ GammaCorrection(线性→sRGB)。

## 二、几何与外观细节

6. **圆角与比例**:外壳一律不用纯直角长方体,用 `RoundedBoxGeometry`(或手动倒角);
   尺寸参照真实量级(本机:32cm × 22cm × ~1.6cm → 场景 3.2 × 2.2 × ~0.16),
   接口凹槽、散热孔、Logo 等细节用简单几何拼出,但比例要准。
7. **键盘**:独立按键阵列(每键独立几何体),支持点击下沉反馈动画
   (约定:模型把按键 Mesh 数组挂在 `group.userData.keys`,管理器负责按压动画)。
8. **质感区分**:玻璃(roughness≤0.1 + clearcoat)/ 哑光金属机身 / 高 roughness 橡胶脚垫,
   渲染结果里必须能明显区分。

## 三、动画与交互质感

9. **缓动**:所有开合、钻入、旋转动画必须用缓动函数(现成 `Ease` 表:
   inOutCubic / outCubic / inCubic),禁止线性插值裸奔。
10. **运镜**:节点切换要像纪录片——先拉远看整体,再平滑推进目标;
    返回时走弧线(贝塞尔中点抬高),禁止瞬间跳转/生硬直线。

## 四、实现备忘(本项目的固定做法)

- 补间按**墙钟时间**推进(面板掉帧也能按时结束);逐帧逻辑(simulate/tick)才用钳制 dt。
- 部件入口 = 父模型中 `name === child.id` 的 Object3D;找不到才回退发光球。
- 模型内部入场动画挂 `group.userData.tick(dt, t)`;节点级逻辑挂 `node.simulate(dt, obj)`。
- 离开节点必须 dispose 几何体/材质/贴图。
- 性能预算:pixelRatio ≤ 2;粒子/高面数部件先做 LOD 分级,再考虑降级开关。
