// clickoutside 指令：点击元素外部时触发回调
// 用法：v-clickoutside="closeFn"
// 关键：el 必须是包含触发器和面板的根容器，这样点击内部任何元素都不会误触发
export default {
  bind(el, binding) {
    el._clickOutside = (e) => {
      const target = e.target
      const panel = el._dropMenuPanel
      const insidePanel = panel && panel.contains && panel.contains(target)
      if (!el.contains(target) && !insidePanel && typeof binding.value === 'function') {
        binding.value(e)
      }
    }
    // 用 setTimeout(0) 避免与触发器 @click 的执行顺序冲突：
    // 当前组件 toggle 先执行（开/关），document click 后判定外部
    document.addEventListener('click', el._clickOutside)
  },
  unbind(el) {
    document.removeEventListener('click', el._clickOutside)
    delete el._clickOutside
  }
}
