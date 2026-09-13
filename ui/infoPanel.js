/* ============================================================
 * ui/infoPanel.js — 底部信息面板
 * 显示当前节点 label/description、悬停提示、叶子节点隐藏操作提示。
 * ============================================================ */
window.LX = window.LX || {};
LX.ui = LX.ui || {};

LX.ui.infoPanel = {
  _els: null,

  _els_() {
    if (!this._els) {
      this._els = {
        label: document.getElementById('node-label'),
        desc: document.getElementById('node-desc'),
        hint: document.getElementById('hover-hint'),
        enterTip: document.getElementById('enter-tip'),
      };
    }
    return this._els;
  },

  /** 渲染当前节点信息 */
  render(node) {
    const el = this._els_();
    el.label.textContent = node.label;
    el.desc.textContent = node.description;
    el.enterTip.style.display = node.children.length ? '' : 'none'; // 叶子节点隐藏提示(需求 5)
  },

  /** 悬停提示文字(空串 = 清除) */
  setHint(text) {
    this._els_().hint.textContent = text;
  },
};
