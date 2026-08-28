// 多实例互斥协调器：模块级单例
// 同时只允许一个 DropMenu 展开，open 时 setActive 触发前一个实例 close
let active = null

export function setActive(instance) {
  if (active && active !== instance && typeof active.close === 'function') {
    active.close()
  }
  active = instance
}

export function clearActive(instance) {
  if (active === instance) active = null
}
