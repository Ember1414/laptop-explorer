/* ============================================================
 * ui/breadcrumb.js — 面包屑导航
 * 渲染当前路径栈;非末级节点可点击跳回(跨多级)。
 * ============================================================ */
window.LX = window.LX || {};
LX.ui = LX.ui || {};

LX.ui.breadcrumb = {
  /**
   * @param {HTMLElement} container #breadcrumb
   * @param {Array} stack 场景树路径栈(节点数组)
   * @param {(index:number)=>void} onJump 点击第 i 级面包屑
   */
  render(container, stack, onJump) {
    container.innerHTML = '';
    stack.forEach((node, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '›';
        container.appendChild(sep);
      }
      const item = document.createElement('span');
      item.textContent = node.label;
      const isLast = i === stack.length - 1;
      item.className = 'crumb' + (isLast ? ' active' : '');
      if (!isLast) item.addEventListener('click', () => onJump(i));
      container.appendChild(item);
    });
  },
};
