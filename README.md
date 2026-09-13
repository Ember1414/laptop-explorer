# Laptop Explorer — 3D 笔记本电脑拆解教学工具

一个**纯浏览器端、零构建**的 Three.js 交互式 3D 应用:一台按真实 14 英寸超极本比例建模的笔记本,可以逐层"拆开"——从整机 → 主板 → CPU 裸片 → 流水线 → ALU → 晶体管,共 **40+ 个可点击模块**,每个模块都带可操作的原理动画(可按、可划、可调参),用于计算机硬件组成原理的可视化学习。

## ✨ 特性

- **场景树导航**:面包屑 + 层级指示 + ←→↑↓ 键切换 + 左侧"☰ 模块导航"全目录直达
- **精确拾取**:悬停判定"真实网格优先于隐形命中盒",指哪判哪;所有节点入口均为真实几何标记(无占位大球)
- **真实 15u 键盘**:74 键 ANSI 布局、双字符键帽、电源键指示灯;字符为不透明贴图,任何距离/角度恒定可读
- **电脑模式(P)**:坐姿全景视角,3D 触控板/屏幕直接控制模拟桌面的光标,3D 键盘可敲击输入;模拟 OS 含记事本/此电脑/设置/虚拟键盘/壁纸更换
- **可操作的原理动画**:键盘穹顶形变+薄膜导通、触控板电场形变、扬声器正弦驱动(频率/幅度滑块)、CMOS 逐行曝光、ADC/DAC 采样阶梯、充电器 AC→DC 粒子流、转轴力矩平衡……
- **画质基线**:PBR 材质 + 三点布光 + SSAO/Bloom 后处理;三档画质手动切换,触屏/小屏自动降档保帧率
- **手机适配**:viewport 隔离缩放、单指旋转/双指缩放平移、面板响应式收窄、触屏专属提示条

## 🎮 操作

| 操作 | 桌面 | 触屏 |
|---|---|---|
| 旋转视角 | 左键拖拽 | 单指拖拽 |
| 平移 | 右键拖拽 / WASD(QE 升降) | 双指拖拽 |
| 缩放 | 滚轮 | 双指捏合 |
| 进入模块 | 悬停高亮后左键点击 | 点按部件 |
| 切换同级模块 | ← → | — |
| 返回上级 | ESC / 面包屑 / ↑ | 面包屑 |
| 全模块直达 | ☰ 模块导航 | ☰ 模块导航 |
| 电脑模式 | P / 🖥 按钮 | 🖥 按钮 |

## 📚 模块目录(场景树)

```
笔记本电脑
├─ 电源适配器        AC → 整流桥 → 高频变压器 → 滤波 → DC(发光粒子流水线)
├─ 键盘             真实 15u 布局 → 单键下钻:剪式支架 + 橡胶穹顶形变 + 薄膜触点导通
├─ 触控板           电极网格 + 电场线随手指导纳形变 → 坐标判定
├─ 摄像头模组       光线 → 镜头组 → CMOS 逐行曝光点亮像素 → 成像
├─ 屏幕            LCD 液晶翻转 / 扫描线 / 刷新率对比
├─ 鼠标            光学传感 + 滚轮编码器
├─ 转轴            齿轮啮合 + 摩擦片力矩平衡(悬停原理)
├─ 主机内部
│  ├─ 主板          真实布线:蛇形等长内存总线、差分对、过孔缝合、丝印位号
│  │  ├─ CPU 封装    → 流水线(取指/译码/执行/访存/写回)→ ALU(门电路)
│  │  │              → 寄存器组 → L3 缓存(命中演示)
│  │  ├─ GPU         → 光栅化管线 → 显示成像
│  │  ├─ 内存 LPDDR  板载颗粒(板上焊装)→ 存储阵列(4 万单元寻址)→ 1T1C 单元
│  │  ├─ SSD         M.2 2280 → NAND 阵列(写入/垃圾回收)
│  │  ├─ 芯片组 PCH   CPU ↔ USB/网卡/音频 数据分发枢纽
│  │  ├─ 无线网卡     电磁波同心圆波纹收发
│  │  ├─ 音频 Codec   模拟波形 ↔ 数字采样(ADC/DAC 双向)
│  │  ├─ ROM/BIOS    POST 自检流程
│  │  └─ 供电 VRM    多相 buck:PWM → 电感/电容滤波
│  ├─ 电池          锂离子迁移充放电
│  ├─ 散热          风扇 + 热管 + 鳍片(热点温度场)
│  └─ 扬声器        音圈/磁隙/振膜,正弦驱动滑块
└─ 半导体           PN 结 / 晶体管 / 电子管对照
```

## 🏗 架构

```
index.html              入口 + 面板 DOM(data-node 与节点 id 关联)
style.css               UI 皮肤(响应式,触屏 media query)
sceneTree.js            ★ 场景树:全部模块的 id/描述/相机距离/model 工厂
sceneManager.js         ★ 导航状态机:栈式进入/返回、运镜、拾取消歧、
                        电脑模式、导览、画质、补间系统
controls.js             OrbitControls 封装(平移/触屏手势)
serve.py                无缓存本地静态服务器(python serve.py [port])
core/
  materials.js          PBR 材质库(alu/screenGlass/led/brushed/grain…)
  lighting.js           三点布光
  postprocessing.js     EffectComposer + SSAO + Bloom(低帧率自动降级)
  csgUtils.js           楔形墙体真实开孔
  particleSystem.js     通用发光粒子系统
  instancedHelper.js    InstancedMesh 批量构建
  easing.js             缓动函数
ui/
  breadcrumb.js         面包屑
  infoPanel.js          信息面板 + data-node 专属交互面板调度
models/                 每个部件一个文件,只管自己的几何/动画/tick
  laptop.js             整机(开盖唤醒、接口内芯、屏幕桌面绘制)
  io/  keyboard touchpad speaker camera mouse
  mainboard/  motherboard vrm chipset wifiCard audioCodec
  cpu/  cpuPackage pipeline alu registers cache assemblySimulator
  memoryStorage/  ram ssd rom
  graphics/  gpu rasterPipeline display
  power/  battery charger
  cooling/ cooling
  semiconductors/ transistor vacuumTube
```

### 关键契约

- **节点入口**:父模型中 `name === child.id` 的 Object3D 即该子节点的点击入口;缺失时回退为贴地光环标记(可见可点)
- **拾取**:真实网格命中优先于隐形命中盒(`userData.isHitbox`),命中盒不膨胀,Sprite 标签不参与包围盒
- **按压反馈**:键帽注册在 `group.userData.keys`,由管理器驱动;字符图例为**不透明 per-build 贴图**(防 alphaTest/mipmap 侵蚀与共享贴图被 dispose)
- **交互面板**:`index.html` 中 `data-node="<id>"` 的面板在进入对应节点时自动显示;DOM 事件统一在 `models/cpu/assemblySimulator.js` 接线
- **错误自证**:tick/pick 异常写入 `window.__errs`,提示栏红字角标实时显示

## 🚀 本地运行

必须走 HTTP(Canvas 纹理 / ES modules 不支持 file://):

```bash
python serve.py 8000        # 或任意静态服务器
# 打开 http://127.0.0.1:8000
```

## ☁️ 部署到 Cloudflare Pages

纯静态、零构建,两种方式任选:

**方式 A:连接 GitHub(推荐,推送即自动部署)**

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → **Connect to Git**
2. 选择本仓库,构建命令留空,**输出目录填 `/`**
3. Save and Deploy

**方式 B:Wrangler 直传**

```bash
npx wrangler login
npx wrangler pages deploy . --project-name=laptop-explorer
```

## 技术栈

Three.js(原生 ES modules,无打包器)· EffectComposer(SSAO/Bloom)· 程序化 Canvas 纹理 · InstancedMesh 批渲染 —— 全部逻辑运行于浏览器本地,无后端、无依赖安装。
