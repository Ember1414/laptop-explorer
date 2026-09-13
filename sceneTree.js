/* ============================================================
 * sceneTree.js — 场景树顶层拼装
 * 各部件 build 函数来自 models/ 模块,这里只负责组织树结构。
 *
 * 节点结构:
 * {
 *   id,             // 唯一标识。父模型中 name === id 的 Object3D 即点击入口
 *   label, description,
 *   cameraDistance, // 进入该节点时相机到目标点的距离
 *   model,          // () => THREE.Object3D  懒加载
 *   simulate,       // (dt, obj) => void     节点级逐帧逻辑
 *   children,
 * }
 * 模型内部入场动画:group.userData.tick = (dt, t) => void
 * 键盘按压反馈:键帽数组挂 group.userData.keys(管理器驱动)
 * ============================================================ */

// 叶子节点的展示模型:单独展示放大版部件,缓慢旋转(原理动画后续阶段实现)
function leaf(id, builder, scale, cameraDistance, label, description, spin = 0.35) {
  return {
    id, label, description, cameraDistance,
    model() { const g = builder(); g.scale.setScalar(scale); return g; },
    simulate(dt, obj) { obj.rotation.y += dt * spin; },
    children: [],
  };
}

const SCENE_TREE = {
  id: 'laptop',
  label: '笔记本电脑',
  description: '一台 14 英寸铝合金超极本(32×22cm,合盖约 1.6cm 厚,前薄后厚的楔形机身)。合上时是圆角的扁平长方体,屏幕通过金属转轴连接主机——现在正在打开。键盘下沉在键帽井里,触控板四周留缝;侧边 HDMI、USB-A、USB-C 是真的开在墙板上的孔,后侧一条散热通槽。点击机身,掀开底盖看看内部。',
  cameraDistance: 7.2,
  model: () => LX.models.laptop.build(),
  simulate: null,
  children: [
    {
      id: 'charger',
      label: '电源适配器',
      description: '整机外的电源砖:把墙上插座的高压交流电变成安全的低压直流。内部流水线:交流输入 → 四只二极管组成的整流桥 → 高频开关管与变压器 → 电容滤波稳压 → 直流输出给电池充电。看发光粒子的颜色:黄(交流)→ 红(高频脉冲)→ 绿(平稳直流)。',
      cameraDistance: 3.6,
      model: () => LX.models.charger.buildDetail(),
      simulate: null,
      children: [],
    },
    {
      id: 'keyboard',
      label: '键盘',
      description: '笔记本的键盘:每个键帽下面都有独立的剪式支架和橡胶穹顶。点击键帽进入单个按键的内部结构。',
      cameraDistance: 3.4,
      model: () => LX.models.keyboard.buildKeyboardNode(),
      simulate: null,
      children: [
        {
          id: 'keyswitch',
          label: '单个按键',
          description: '按键的"手感"来自三层结构:橡胶穹顶提供回弹力,剪式支架让键帽平稳上下,两层薄膜电路在穹顶被压实的一瞬间导通(绿色电弧 = 信号发出)。用面板按钮按下和松开,看穹顶压扁与弹性回弹。',
          cameraDistance: 2.8,
          model: () => LX.models.keyboard.keySwitchNode(),
          simulate: null,
          children: [],
        },
      ],
    },
    {
      id: 'touchpad',
      label: '触控板',
      description: '电容式触控板:板下是一张电极网格。手指(胶囊体)靠近时,附近电极的电场线发生形变——芯片测量哪些交叉点的电容变化,就能算出手指坐标(金色十字 = 判定结果)。手指自动扫描,观察电场线如何跟随。',
      cameraDistance: 3.2,
      model: () => LX.models.touchpad.build(),
      simulate: null,
      children: [],
    },
    {
      id: 'camera',
      label: '摄像头模组',
      description: '藏在屏幕边框顶部的摄像头模组:光线穿过镜头组(多片透镜折射聚焦),打在 CMOS 传感器网格上,每个像素把光强转换成电信号。看扫描光线逐行点亮像素,一幅"照片"就这样成形——完成后自动重新曝光,也可用面板按钮重拍。',
      cameraDistance: 3.4,
      model() { const g = LX.models.camera.build(); g.scale.setScalar(1.6); return g; },
      simulate: null,
      children: [],
    },
    {
      id: 'screen',
      label: '显示屏(工作原理)',
      description: '点按屏幕看到的显示原理:左侧是 LCD 五层分解——背光 LED 阵列 → 下偏光片 → 液晶分子 → RGB 滤色片 → 上偏光片;右侧是 OLED 自发光对比;前方 Framebuffer 逐行扫描演示,60Hz/120Hz 可切换感受刷新率。',
      cameraDistance: 6.2,
      model: () => LX.models.display.build(),
      simulate: null,
      children: [],
    },
    {
      id: 'mouse',
      label: '鼠标(光学定位原理)',
      description: '外接光学鼠标的定位原理:底部 LED 照亮表面,CMOS 图像阵列每秒拍摄数千张微观照片,DSP 对比连续帧算出位移增量;滚轮是光栅编码器,按键是微动开关。分解视图 + 采样光路演示。',
      cameraDistance: 3.0,
      model() { const g = LX.models.mouse.buildDetail(); g.scale.setScalar(1.4); return g; },
      simulate: null,
      children: [],
    },
    {
      id: 'hinge',
      label: '转轴(悬停结构)',
      description: '屏幕为什么能停在任意角度而不下垂?转轴里有摩擦片组和齿轮啮合:摩擦片被螺母压紧在转轴柱上,摩擦力矩始终平衡屏幕的重力力矩。看屏幕在几个角度间缓慢停驻——每次都稳稳悬停。',
      cameraDistance: 3.4,
      model: () => LX.models.hinge.buildDetail(),
      simulate: null,
      children: [],
    },
    {
      id: 'interior',
      label: '主机内部',
      description: '掀开底盖后的超极本内部:后面是一块全宽主板(29.8cm,布线与真机对应),前面一大片是电池,右后是离心风扇和热管,两侧边缘各有一个扬声器;M.2 固态硬盘斜插在主板插座上、LPDDR 内存焊接在板上。底盖上还留着七颗十字螺丝。点击任意部件深入了解。',
      cameraDistance: 4.2,
      model: buildInteriorModel,
      simulate: null,
      children: [
        {
          id: 'motherboard',
          label: '主板',
          description: '超极本的主板是一块高度集成的异形小板:右上缺角给风扇让位,前缘凹口避开电池卡扣,右侧延伸段插着 M.2。表面能看到多层铜走线、过孔和丝印位号——CPU/GPU 封装、供电电感、防爆槽电容各就各位。板上有块供电模块在闪烁,点击深入了解。',
          cameraDistance: 3.8,
          model: () => LX.models.motherboard.build(),
          simulate: null,
          children: [
            {
              id: 'vrm',
              label: 'VRM 供电模块',
              description: 'VRM 把电池的直流电"切"成高频脉冲再滤回精确的低压直流:MOSFET 高低臂交替高速通断(蓝色/橙色交替发光),电感储能缓冲,输出电容把纹波滤平。看粒子流:输入侧断续脉冲,经过电感与电容后,输出侧已变成均匀直流。',
              cameraDistance: 2.4,
              model: () => LX.models.vrm.buildDetail(),
              simulate: null, // 粒子流与开合动画在 userData.tick 中驱动
              children: [],
            },
            {
              id: 'gpu',
              label: 'GPU(显卡芯片)',
              description: '比 CPU 更大的裸片,周围环绕 GDDR 显存颗粒——显存贴着芯片放,是因为带宽就是一切。这个区域走线密度也明显高于主板其他地方。点击进入:看 3D 画面是怎么从顶点变成屏幕像素的,以及显示屏面板的分层构造。',
              cameraDistance: 3.4,
              model: () => LX.models.gpu.buildNode(),
              simulate: null,
              children: [
                {
                  id: 'raster',
                  label: '光栅化管线',
                  description: '3D 模型是怎么变成屏幕像素的?看这条流水线:① 顶点数据(三个带颜色的点)→ ② 顶点着色器(矩阵实时变换它们的位置)→ ③ 图元装配(点连成三角形线框)→ ④ 光栅化(三角形内部被像素网格逐行填充)→ ⑤ 片元着色(每个像素按光照公式变色)。15 秒一个循环,盯着活跃的高亮段看。',
                  cameraDistance: 8.2,
                  model: () => LX.models.raster.build(),
                  simulate: null,
                  children: [],
                },
                {
                  id: 'display',
                  label: '显示屏面板',
                  description: '左侧是 LCD 的五层分解:背光 LED 阵列 → 下偏光片 → 液晶分子棒(随电压旋转)→ RGB 滤光片 → 上偏光片。右侧是 OLED 对比:没有背光和偏光片,子像素自发光。前方是 Framebuffer 逐行扫描演示——用按钮切换 60Hz / 120Hz 感受刷新率差异。',
                  cameraDistance: 6.2,
                  model: () => LX.models.display.build(),
                  simulate: null,
                  children: [],
                },
              ],
            },
            {
              id: 'rom',
              label: 'BIOS 芯片(ROM)',
              description: '主板上的 BIOS 芯片存着开机固件。按下电源后它最先醒来,执行加电自检(POST):逐项检测 CPU、内存、存储、显示……注意每项耗时不一——内存测试最慢。自检全部打勾后,才把控制权交给操作系统。等待片刻,它会自动重新自检。',
              cameraDistance: 3.6,
              model: () => LX.models.rom.post(),
              simulate: null,
              children: [],
            },
            {
              id: 'chipset',
              label: '芯片组(PCH)',
              description: '芯片组是主板上的"交通枢纽":CPU 只和它高速对话,再由它转发给 USB、无线网卡、音频等所有外围设备。看发光的数据包从 CPU 下来,经 PCH 分发到各个设备,再汇聚回 CPU——它让所有部件协调成一个整体。',
              cameraDistance: 4.6,
              model: () => LX.models.chipset.build(),
              simulate: null,
              children: [],
            },
            {
              id: 'wifi',
              label: '无线网卡',
              description: 'M.2 插槽上的无线网卡:主控芯片经馈线连接藏在屏幕边框内的天线。天线发出同心圆电磁波——数据靠它收发,替代了网线。天线藏在屏幕上沿,所以合盖也会影响信号。',
              cameraDistance: 3.6,
              model: () => LX.models.wifi.build(),
              simulate: null,
              children: [],
            },
            {
              id: 'codec',
              label: '音频编解码芯片',
              description: '声音是连续的模拟波,电脑只认离散的数字。录音时 ADC 把波形采样+量化成阶梯状数字;播放时 DAC 把数字还原成平滑波形驱动扬声器(旁边晶振提供精确采样时钟)。',
              cameraDistance: 3.4,
              model: () => LX.models.audioCodec.build(),
              simulate: null,
              children: [],
            },
            {
              id: 'cpu',
              label: 'CPU(处理器)',
              description: '中央处理器。金属顶盖(IHS)之下是硅裸片——掀开顶盖看看里面,再进入裸片上的流水线,看一条指令如何经过取指、译码、执行、写回。',
              cameraDistance: 2.6,
              model: () => LX.models.cpu.package(),
              simulate: null, // 掀盖动画在 userData.tick
              children: [
                {
                  id: 'pipeline',
                  label: '流水线(芯片内部)',
                  description: '放大后的硅裸片:一条指令依次经过 取指 IF → 译码 ID → 执行 EX → 写回 WB 四段流水隧道,胶囊就是正在流动的指令。右侧面板输入玩具汇编程序,点"运行"跟随镜头看它们流动,或用"单步"逐条观察。',
                  cameraDistance: 4.4,
                  model: () => LX.models.pipeline.build(),
                  simulate: null,
                  children: [
                    {
                      id: 'alu',
                      label: 'ALU(全加器)',
                      description: '执行阶段的心脏:用标准的 AND/OR/XOR 门符号搭出一个全加器。加法输出绿色高亮,进位 Cout 传播路径红色高亮。下方按钮可手动切换输入 A/B/Cin,观察门与信号线如何响应;不操作时自动循环真值表。',
                      cameraDistance: 3.0,
                      model: () => LX.models.alu.build(),
                      simulate: null,
                      children: [
                        {
                          id: 'transistor',
                          label: '晶体管(PN 结)',
                          description: '门是由晶体管搭的,晶体管的心脏是 PN 结:左 P 区多空穴(红环),右 N 区多电子(蓝球),交界处是耗尽层。拖动电压滑块:正偏——耗尽层变窄,载流子跨过结区相遇复合(闪光);反偏——耗尽层变宽,载流子被拉回,电流截止。这就是"开关"的物理本质。',
                          cameraDistance: 3.4,
                          model: () => LX.models.transistor.build(),
                          simulate: null,
                          children: [
                            {
                              id: 'vacuumtube',
                              label: '电子管(对照)',
                              description: '晶体管之前,人们用真空电子管做同样的事:灯丝加热阴极,电子"蒸发"进真空,栅极上的一个小电压决定多少电子能飞到阳极——小电流控制大电流。拖动栅极电压,看电子流被调粗调细;它和晶体管本质上做的是同一件事,只是载体不同。',
                              cameraDistance: 3.4,
                              model: () => LX.models.vacuumTube.build(),
                              simulate: null,
                              children: [],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      id: 'registers',
                      label: '寄存器组',
                      description: '流水线最末端的存储单元:8 个寄存器槽,写入光不断扫过并翻转各位的值。寄存器是 CPU 内最快的存储——每个时钟周期都能读写。',
                      cameraDistance: 3.2,
                      model: () => LX.models.registers.build(),
                      simulate: null,
                      children: [],
                    },
                    {
                      id: 'cache',
                      label: '缓存(命中/未命中)',
                      description: '为什么需要缓存?点下方按钮对比:命中时数据从 L1 直达寄存器——又快又稳;未命中时要从内存经 L3→L2→L1 逐级搬运,进度条与脉冲提示漫长的等待。缓存用小容量换快速度,把常用数据放在离核心最近的地方。',
                      cameraDistance: 4.6,
                      model: () => LX.models.cache.build(),
                      simulate: null,
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'battery',
          label: '电池',
          description: '四节软包锂聚合物电芯并排,哑光银色铝塑膜外壳,顶部是极耳与排气阀。点进内部:正极、隔膜、负极、隔膜逐层卷绕成"卷芯"(jelly roll)——充电时锂离子穿过隔膜从正极搬到负极,放电时再搬回来。',
          cameraDistance: 3.6,
          model: () => LX.models.battery.package(),
          simulate: null,
          children: [
            {
              id: 'batterycore',
              label: '卷芯内部(jelly roll)',
              description: '切开的软包:里面不是平铺的三层,而是把正极箔、隔膜、负极箔、隔膜层层卷绕成的螺旋"卷芯"——同样的面积卷出几倍的容量。绿色发光小球是锂离子:点"充电/放电"看它们带着随机热运动穿过隔膜往返迁移。',
              cameraDistance: 3.4,
              model: () => LX.models.battery.buildCore(),
              simulate: null,
              children: [],
            },
          ],
        },
        {
          id: 'cooling',
          label: '风扇与热管',
          description: '单个离心风扇(鼓风机)从侧面吸风,热管把 CPU/GPU 的热量传导到散热鳍片。看热管内部:工质在蒸发端吸热变红(液→气),流到鳍片冷凝变蓝(气→液),持续循环。右侧滑块调 CPU 负载——风扇转速带惯性平滑升降,高转速下叶片出现运动模糊。',
          cameraDistance: 3.0,
          model: () => LX.models.cooling.build(),
          simulate: null,
          children: [],
        },
        {
          id: 'speaker',
          label: '扬声器',
          description: '左右两个细长的扬声器单元,贴着机身两侧边缘安装,尽量不与主板和电池争夺空间。点击其中一个单元,看线圈、磁体与振膜如何把电流变成声音。',
          cameraDistance: 3.6,
          model() { const g = LX.models.speaker.build(); g.scale.setScalar(1.7); return g; },
          simulate(dt, obj) { obj.rotation.y += dt * 0.35; },
          children: [
            {
              id: 'speakerdetail',
              label: '扬声器单元(音圈与振膜)',
              description: '动圈式扬声器的核心:音圈悬在永磁体的磁隙里,音频电流通过线圈产生交变磁场,与永磁体相互作用推动振膜前后振动。右侧滑块调正弦驱动信号——频率改变振动快慢(音调),幅度改变振动强弱(音量),线圈发光与磁隙磁场环随瞬时电流变化。',
              cameraDistance: 2.8,
              model() { const g = LX.models.speaker.buildDetail(); g.scale.setScalar(1.5); return g; },
              simulate: null,
              children: [],
            },
          ],
        },
        {
          id: 'm2',
          label: 'M.2 固态硬盘',
          description: '巴掌大小的 M.2 2280 规格:主控芯片 + 两颗 NAND 闪存颗粒 + 金手指。它取代了老式 2.5 英寸机械硬盘,是笔记本能做轻做薄、开机秒进的功臣。点击 NAND 颗粒,看闪存怎么写入、擦除与垃圾回收。',
          cameraDistance: 2.2,
          model: () => LX.models.ssd.build(),
          simulate: null,
          children: [
            {
              id: 'nand',
              label: 'NAND 颗粒(页与块)',
              description: '闪存按"页"写入(绿色 = 有效数据)、按"块"擦除。用"写入"把块 A 填满,再触发"垃圾回收":有效数据先被逐页搬到备用块 B,然后整块擦除、恢复空白——这就是 SSD 不会像机械硬盘那样原地覆盖写入的原因。',
              cameraDistance: 3.8,
              model: () => LX.models.ssd.buildNand(),
              simulate: null,
              children: [],
            },
          ],
        },
        {
          id: 'memory',
          label: '板载内存(LPDDR)',
          description: 'LPDDR 内存颗粒直接焊在主板上(板载内存),没有插槽、不可更换——换来的是更薄的机身、更短的走线和更低的功耗。颗粒里是数以亿计的存储单元,点击进入阵列看看一次寻址是怎么发生的。',
          cameraDistance: 2.4,
          model: () => LX.models.ram.package(),
          simulate: null,
          children: [
            {
              id: 'ramarray',
              label: '存储单元阵列',
              description: '放大后的内存阵列:4 万个存储单元按 200×200 网格排布(真实芯片为数亿个,这里做了 LOD 降采样)。在右侧面板输入行/列地址,看行译码器与列译码器的选通光线沿总线传播,精确命中交叉点的那一个单元。',
              cameraDistance: 4.6,
              model: () => LX.models.ram.array(),
              simulate: null,
              children: [
                {
                  id: 'cell',
                  label: '存储单元(1T1C)',
                  description: '一个 DRAM 存储单元 = 1 个晶体管 + 1 个电容。电容里"液体"的电荷量表示存的是 1 还是 0——注意电荷会缓慢泄漏(液面下降),降到警戒线就要刷新。这就是 DRAM 需要不停刷新的原因。用按钮试试充电与放电。',
                  cameraDistance: 2.8,
                  model: () => LX.models.ram.cell(),
                  simulate: null,
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/* ---------- "主机内部"模型:托盘 + 部件布局 + 掀盖动画 ---------- */
function buildInteriorModel() {
  const M = LX.materials;
  const g = new THREE.Group();

  // 底板 + 四周墙体(与外观同构,接口孔/散热槽从内侧可见)
  const floor = LX.geo.rbox(3.14, 0.03, 2.14, M.mat(0x565d68, { metalness: 0.6, roughness: 0.55, roughnessMap: LX.textures.brushed() }), 0.008, 1);
  floor.position.y = 0.015;
  g.add(
    floor,
    LX.models.laptop.buildSideWall(-1),
    LX.models.laptop.buildSideWall(1),
    LX.models.laptop.buildRearWall(true),
    LX.models.laptop.buildFrontWall()
  );

  // 屏幕总成保持掀开状态
  const lid = LX.models.laptop.buildScreenLid();
  lid.position.set(0, 0.15, -1.02);
  lid.rotation.x = -1.85;
  g.add(lid);

  // 掀开的底盖(入场动画:向上后方翻开,如同立起的检修盖板)+ 固定螺丝
  const coverHinge = new THREE.Group();
  coverHinge.position.set(0, 0.16, -1.05);
  const cover = LX.geo.rbox(3.17, 0.025, 2.17, M.alu(), 0.012, 2);
  cover.position.set(0, 0, 1.07);
  const coverInner = LX.geo.rbox(3.0, 0.01, 2.0, M.mat(0x565d68, { metalness: 0.6, roughness: 0.55, roughnessMap: LX.textures.brushed() }), 0.006, 1);
  coverInner.position.set(0, -0.016, 1.07);
  coverHinge.add(cover, coverInner);

  // 十字螺丝(InstancedMesh ×2:螺头 + 十字槽,带扰动)
  const rnd = LX.textures.random(20);
  const screwPts = [[-1.3, 1.95], [-0.65, 1.95], [0, 1.95], [0.65, 1.95], [1.3, 1.95], [-1.3, 0.25], [1.3, 0.25]];
  const headT = [], slotT = [];
  for (const [sx, sz] of screwPts) {
    const ry = rnd() * Math.PI;
    headT.push({ p: [sx + (rnd() - 0.5) * 0.02, -0.026, sz + (rnd() - 0.5) * 0.02], r: [0, ry, 0] });
    slotT.push({ p: [sx + (rnd() - 0.5) * 0.02, -0.0215, sz + (rnd() - 0.5) * 0.02], r: [0, ry, 0] });
  }
  const steel = M.mat(0x9aa2ad, { metalness: 0.9, roughness: 0.3 });
  coverHinge.add(
    LX.instanced.build(new THREE.CylinderGeometry(0.024, 0.024, 0.008, 14), steel, headT),
    LX.instanced.build(new THREE.BoxGeometry(0.036, 0.003, 0.006), M.mat(0x14171c, { metalness: 0.6, roughness: 0.4 }), slotT)
  );
  g.add(coverHinge);

  // 内部部件(各自的 name 即可点击入口;M.2 与 LPDDR 已在主板上,
  // 点击主板上的 SSD/内存颗粒即可进入对应节点)
  const parts = [
    ['motherboard', LX.models.motherboard.build(), 0, 0.04, -0.52],
    ['battery', LX.models.battery.package(), -0.1, 0.04, 0.52],
    ['cooling', LX.models.cooling.build(), 0.72, 0.065, -0.56],
    ['speaker', LX.models.speaker.build(), 0, 0.04, 0.6],
  ];
  for (const [name, p, x, y, z] of parts) {
    p.name = name;
    p.position.set(x, y, z);
    g.add(p);
  }

  // 内部走线:电池/风扇/双扬声器 → 主板上对应连接器(弯管线缆)
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.6 });
  const mkWire = (pts, r = 0.012) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 32, r, 8, false), wireMat);
  };
  g.add(
    mkWire([[1.02, 0.05, 0.12], [0.5, 0.05, 0.0], [-0.5, 0.055, -0.02], [-1.15, 0.06, -0.05]]),        // 电池 → 6pin 座
    mkWire([[0.15, 0.07, -0.83], [0.08, 0.07, -0.86], [0.02, 0.07, -0.87]], 0.01),                      // 风扇 → 4pin 座
    mkWire([[-1.35, 0.06, 0.35], [-1.42, 0.05, 0.02], [-1.0, 0.05, 0.0], [-0.75, 0.055, -0.03]], 0.009),  // 扬声器 L → 3pin 座
    mkWire([[1.35, 0.06, 0.35], [1.32, 0.05, 0.08], [0.9, 0.05, 0.0], [0.55, 0.055, -0.03]], 0.009),      // 扬声器 R → 3pin 座
  );

  // 入场:掀盖 + 部件依次落位
  g.userData.tick = (dt, t) => {
    coverHinge.rotation.x = -2.3 * LX.Ease.outCubic(Math.min(Math.max((t - 0.4) / 1.2, 0), 1));
    parts.forEach(([, p, , baseY], i) => {
      const e = LX.Ease.outCubic(Math.min(Math.max((t - 0.5 - i * 0.09) / 0.8, 0), 1));
      p.position.y = baseY - 0.15 * (1 - e);
    });
  };
  return g;
}
