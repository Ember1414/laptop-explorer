/* ============================================================
 * models/cpu/assemblySimulator.js — 玩具汇编模拟器
 * 指令集:MOV d, imm | ADD d, s(寄存器或立即数)| SUB d, s | OUT d
 * 寄存器:A B D(8bit 溢出回绕)
 * 与 #asm-panel(DOM)对接:载入程序到当前 pipeline 节点,
 * 运行/单步由流水线的 userData.api 执行,相机跟随由 LX.follow 驱动。
 * ============================================================ */
window.LX = window.LX || {};
LX.sim = {};

LX.sim.parse = function (code) {
  const prog = [];
  for (let line of code.split('\n')) {
    line = line.split(';')[0].trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z]+)\s+([A-D])\s*,\s*([A-Da-d]|\d+)\s*$/i);
    if (!m) continue;
    const op = m[1].toUpperCase();
    const d = m[2].toUpperCase();
    let imm, sreg;
    if (/^[A-Da-d]$/.test(m[3])) sreg = m[3].toUpperCase();
    else imm = parseInt(m[3], 10) & 0xff;
    prog.push({ op, d, imm, sreg });
  }
  return prog;
};

(function wireUI() {
  const currentApi = () => {
    const m = window.__mgr;
    if (!m || m.stack[m.stack.length - 1].id !== 'pipeline') return null;
    return m.currentGroup.userData.api || null;
  };

  window.addEventListener('DOMContentLoaded', () => {
    const run = document.getElementById('asm-run');
    const step = document.getElementById('asm-step');
    const reset = document.getElementById('asm-reset');
    const code = document.getElementById('asm-code');
    if (!run) return;
    run.addEventListener('click', () => {
      const api = currentApi();
      if (!api) return;
      api.load(LX.sim.parse(code.value));
      api.run();
    });
    step.addEventListener('click', () => {
      const api = currentApi();
      if (!api) return;
      if (!api.loaded) api.load(LX.sim.parse(code.value));
      api.step();
    });
    reset.addEventListener('click', () => {
      const api = currentApi();
      if (api) api.reset();
    });

    // ALU 输入切换按钮
    const bindToggle = (id, key) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => {
        const m = window.__mgr;
        if (!m || m.stack[m.stack.length - 1].id !== 'alu') return;
        const api = m.currentGroup.userData.api;
        if (api) b.textContent = key + ' = ' + api.toggle(key);
      });
    };
    bindToggle('alu-a', 'A');
    bindToggle('alu-b', 'B');
    bindToggle('alu-cin', 'Cin');

    // 缓存对比按钮
    const ch = document.getElementById('cache-hit');
    const cm = document.getElementById('cache-miss');
    const cacheApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'cache') return null;
      return m.currentGroup.userData.api || null;
    };
    if (ch) ch.addEventListener('click', () => { const a = cacheApi(); if (a) a.simulate('hit'); });
    if (cm) cm.addEventListener('click', () => { const a = cacheApi(); if (a) a.simulate('miss'); });

    // RAM 阵列:地址选通
    const ramApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'ramarray') return null;
      return m.currentGroup.userData.api || null;
    };
    const rs = document.getElementById('ram-select');
    const rr = document.getElementById('ram-random');
    const rrow = document.getElementById('ram-row');
    const rcol = document.getElementById('ram-col');
    if (rs) rs.addEventListener('click', () => {
      const a = ramApi();
      if (a) a.select(Math.min(199, Math.max(0, +rrow.value | 0)), Math.min(199, Math.max(0, +rcol.value | 0)));
    });
    if (rr) rr.addEventListener('click', () => {
      const a = ramApi();
      if (!a) return;
      a.random();
      const s = a.status();
      const mr = s.match(/行 (\d+)\(/), mc = s.match(/列 (\d+)\(/);
      if (mr && rrow) rrow.value = mr[1];
      if (mc && rcol) rcol.value = mc[1];
      const stEl = document.getElementById('ram-status');
      if (stEl) stEl.textContent = s;
    });

    // 存储单元:充放电/刷新
    const cellApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'cell') return null;
      return m.currentGroup.userData.api || null;
    };
    const bindCell = (id, fn) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => { const a = cellApi(); if (a) fn(a); });
    };
    bindCell('cell-charge', a => a.charge());
    bindCell('cell-discharge', a => a.discharge());
    bindCell('cell-refresh', a => a.refresh());

    // 显示面板:刷新率切换
    const dispApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'display') return null;
      return m.currentGroup.userData.api || null;
    };
    const h60 = document.getElementById('hz-60');
    const h120 = document.getElementById('hz-120');
    if (h60) h60.addEventListener('click', () => { const a = dispApi(); if (a) a.setHz(60); });
    if (h120) h120.addEventListener('click', () => { const a = dispApi(); if (a) a.setHz(120); });

    // 单个按键:按下/松开
    const ksApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'keyswitch') return null;
      return m.currentGroup.userData.api || null;
    };
    const ksp = document.getElementById('ks-press');
    const ksr = document.getElementById('ks-release');
    if (ksp) ksp.addEventListener('click', () => { const a = ksApi(); if (a) a.press(); });
    if (ksr) ksr.addEventListener('click', () => { const a = ksApi(); if (a) a.release(); });

    // 电池:充放电方向
    const batApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'batterycore') return null;
      return m.currentGroup.userData.api || null;
    };
    const bc = document.getElementById('bat-charge');
    const bd = document.getElementById('bat-discharge');
    if (bc) bc.addEventListener('click', () => { const a = batApi(); if (a) a.setMode('charge'); });
    if (bd) bd.addEventListener('click', () => { const a = batApi(); if (a) a.setMode('discharge'); });

    // 散热:负载滑块
    const cl = document.getElementById('cool-load');
    const coolApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'cooling') return null;
      return m.currentGroup.userData.api || null;
    };
    if (cl) cl.addEventListener('input', () => { const a = coolApi(); if (a) a.setLoad((+cl.value) / 100); });

    // 晶体管:电压滑块 + 自动演示
    const pnv = document.getElementById('pn-v');
    const pna = document.getElementById('pn-auto');
    const pnApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'transistor') return null;
      return m.currentGroup.userData.api || null;
    };
    if (pnv) pnv.addEventListener('input', () => { const a = pnApi(); if (a) a.setV((+pnv.value) / 10); });
    if (pna) pna.addEventListener('click', () => { const a = pnApi(); if (a) a.resumeAuto(); });

    // 电子管:栅极电压 + 电源
    const tvg = document.getElementById('tube-vg');
    const tpw = document.getElementById('tube-power');
    const tubeApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'vacuumtube') return null;
      return m.currentGroup.userData.api || null;
    };
    if (tvg) tvg.addEventListener('input', () => { const a = tubeApi(); if (a) a.setVg((+tvg.value) / 10); });
    if (tpw) tpw.addEventListener('click', () => { const a = tubeApi(); if (a) { a.setPower(!a.powered); tpw.textContent = a.powered ? '⏻ 灯丝电源:开' : '⏻ 灯丝电源:关'; } });

    // NAND:写入/垃圾回收
    const nandApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'nand') return null;
      return m.currentGroup.userData.api || null;
    };
    const nw = document.getElementById('nand-write');
    const ng = document.getElementById('nand-gc');
    if (nw) nw.addEventListener('click', () => { const a = nandApi(); if (a) a.write(); });
    if (ng) ng.addEventListener('click', () => { const a = nandApi(); if (a) a.gc(); });

    // 扬声器:驱动信号滑块(频率 → 振膜振动速度,幅度 → 振动强弱)
    const spkApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'speakerdetail') return null;
      return m.currentGroup.userData.api || null;
    };
    const spkF = document.getElementById('spk-freq');
    const spkA = document.getElementById('spk-amp');
    if (spkF) spkF.addEventListener('input', () => { const a = spkApi(); if (a) a.setFreq((+spkF.value) / 100); });
    if (spkA) spkA.addEventListener('input', () => { const a = spkApi(); if (a) a.setAmp((+spkA.value) / 100); });

    // 触控板:自动扫描开关
    const tpBtn = document.getElementById('touchpad-auto');
    const tpApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'touchpad') return null;
      return m.currentGroup.userData.api || null;
    };
    let tpAuto = true;
    if (tpBtn) tpBtn.addEventListener('click', () => {
      tpAuto = !tpAuto;
      const a = tpApi(); if (a) a.setAuto(tpAuto);
      tpBtn.textContent = tpAuto ? '⏸ 暂停自动扫描' : '▶ 恢复自动扫描';
    });

    // 音频编解码:ADC / DAC 方向切换
    const codecApi = () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'codec') return null;
      return m.currentGroup.userData.api || null;
    };
    const cAdc = document.getElementById('codec-adc');
    const cDac = document.getElementById('codec-dac');
    const codecSt = document.getElementById('codec-status');
    if (cAdc) cAdc.addEventListener('click', () => {
      const a = codecApi(); if (!a) return;
      a.setMode('adc');
      if (codecSt) codecSt.textContent = '当前:ADC — 波形被采样+量化成阶梯';
    });
    if (cDac) cDac.addEventListener('click', () => {
      const a = codecApi(); if (!a) return;
      a.setMode('dac');
      if (codecSt) codecSt.textContent = '当前:DAC — 阶梯数字经低通滤波还原为平滑波形';
    });

    // 摄像头:重新拍摄(清空 CMOS,从头曝光)
    const camBtn = document.getElementById('camera-shot');
    if (camBtn) camBtn.addEventListener('click', () => {
      const m = window.__mgr;
      if (!m || m.stack[m.stack.length - 1].id !== 'camera') return;
      const a = m.currentGroup.userData.api;
      if (a) a.shot();
    });
  });
})();
