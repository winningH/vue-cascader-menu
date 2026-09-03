import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, createWrapper } from '@vue/test-utils'
import DropMenu from '../DropMenu.vue'
import DropMenuItem from '../DropMenuItem.vue'

// 测试树：label 一律等于 value，方便查找。一级 a（已加载含二级）、一级 x（待异步加载）、叶子 leaf、禁用项
function makeTree() {
  return [
    {
      label: 'a', value: 'a', hasChildren: true,
      children: [
        {
          label: 'b', value: 'b', hasChildren: true,
          children: [
            { label: 'c', value: 'c', hasChildren: true, children: [] },   // 待加载三级
            { label: 'bleaf', value: 'bleaf', hasChildren: false }         // 三级叶子
          ]
        },
        { label: 'b2', value: 'b2', hasChildren: true, children: [] },     // 待加载二级
        { label: 'aleaf', value: 'aleaf', hasChildren: false }             // 二级叶子
      ]
    },
    { label: 'x', value: 'x', hasChildren: true, children: [] },           // 待加载一级
    { label: 'leaf', value: 'leaf', hasChildren: false },                  // 一级叶子
    { label: 'dis', value: 'dis', hasChildren: true, children: [{ label: 'dc', value: 'dc', hasChildren: false }], disabled: true }
  ]
}

function getPanel() {
  return document.body.querySelector('.dm-panel')
}

// 按 .dm-label 精确匹配节点
// 注意：本环境 findAll 返回的 WrapperArray 不是真数组，这里用原生 querySelectorAll + createWrapper 保证可靠
function findItem(wrapper, value) {
  const els = Array.from(document.body.querySelectorAll('.dm-item'))
  const el = els.find((el) => el.querySelector('.dm-label').textContent.trim() === value)
  return el ? createWrapper(el, wrapper.options) : undefined
}

async function clickItem(wrapper, value) {
  const item = findItem(wrapper, value)
  expect(item, `item ${value} should exist and be visible`).toBeTruthy()
  await item.trigger('click')
}

async function openMenu(wrapper) {
  await wrapper.find('.dm-trigger').trigger('click')
}

describe('DropMenu', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(DropMenu, {
      propsData: { title: 'test', data: makeTree() }
    })
  })

  afterEach(() => {
    wrapper && wrapper.destroy()
  })

  it('初始状态：面板隐藏，展开路径为空', () => {
    expect(getPanel()).toBeNull()
    expect(wrapper.vm.expandedPath).toEqual([])
  })

  it('点击触发器开合面板', async () => {
    await openMenu(wrapper)
    expect(getPanel()).toBeTruthy()
    expect(getPanel().style.display).not.toBe('none')
    await openMenu(wrapper)
    expect(getPanel()).toBeNull()
  })

  it('点击一级叶子：emit select，payload 含自身副本/path/valuePath，并自动关闭', async () => {
    await openMenu(wrapper)
    await clickItem(wrapper, 'leaf')

    expect(wrapper.emitted('select')).toBeTruthy()
    const payload = wrapper.emitted('select')[0][0]
    expect(payload.value).toBe('leaf')
    expect(payload.label).toBe('leaf')
    expect(payload.path.map((n) => n.value)).toEqual(['leaf'])
    expect(payload.valuePath).toEqual(['leaf'])
    // 叶子选中自动关闭
    expect(getPanel()).toBeNull()
  })

  it('点击待加载节点：记录展开路径、emit select，不关闭', async () => {
    await openMenu(wrapper)
    await clickItem(wrapper, 'x')

    // expand 事件被根组件内部消费（更新 expandedPath），不对外透传，断言状态而非事件
    expect(wrapper.vm.expandedPath).toEqual(['x'])

    expect(wrapper.emitted('select')).toBeTruthy()
    const payload = wrapper.emitted('select')[0][0]
    expect(payload.value).toBe('x')
    expect(payload.hasChildren).toBe(true)
    // 不关闭
    expect(getPanel()).toBeTruthy()
  })

  it('外部 $set 原节点 children 后子菜单自动展开（异步加载流程）', async () => {
    await openMenu(wrapper)
    await clickItem(wrapper, 'x')

    const node = wrapper.emitted('select')[0][0].path[0]
    expect(node.value).toBe('x')

    wrapper.vm.$set(node, 'loading', true)
    await wrapper.vm.$nextTick()
    expect(findItem(wrapper, 'x').find('.dm-spin').exists()).toBe(true) // 转圈中

    wrapper.vm.$set(node, 'children', [{ label: 'xleaf', value: 'xleaf', hasChildren: false }])
    wrapper.vm.$set(node, 'loading', false)
    await wrapper.vm.$nextTick()

    // 子菜单自动出现且包含新数据
    const sub = findItem(wrapper, 'x').element.parentElement.querySelector('.dm-sub')
    expect(sub.style.display).not.toBe('none')
    expect(sub.textContent).toContain('xleaf')
  })

  it('面板挂载于 body，且子菜单仍归属于根菜单节点树', async () => {
    await openMenu(wrapper)
    const panel = getPanel()
    expect(panel).toBeTruthy()
    expect(panel.parentElement).toBe(document.body)
    const firstItem = panel.querySelector('.dm-item')
    expect(firstItem).toBeTruthy()
    expect(firstItem.closest('.dm-panel')).toBe(panel)
  })

  it('页面滚动时根面板和已展开子菜单跟随触发器重新定位', async () => {
    const triggerRect = { left: 10, bottom: 40 }
    const rootItemRect = { top: 50 }
    const panelRect = { right: 170 }
    const trigger = wrapper.find('.dm-trigger').element
    trigger.getBoundingClientRect = () => triggerRect

    await openMenu(wrapper)
    await clickItem(wrapper, 'a')
    await wrapper.vm.$nextTick()

    const rootItem = findItem(wrapper, 'a').element
    rootItem.getBoundingClientRect = () => rootItemRect
    getPanel().getBoundingClientRect = () => panelRect
    triggerRect.left = 30
    triggerRect.bottom = 80
    rootItemRect.top = 95
    panelRect.right = 190

    document.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()

    expect(getPanel().style.left).toBe('30px')
    expect(getPanel().style.top).toBe('84px')
    const sub = rootItem.closest('.dm-item-wrap').querySelector('.dm-sub')
    expect(sub.style.left).toBe('190px')
    expect(sub.style.top).toBe('95px')
  })

  it('逐级展开：祖先保持激活（isActive 前缀语义，回归用例）', async () => {
    await openMenu(wrapper)
    await clickItem(wrapper, 'a') // 展开一级
    await clickItem(wrapper, 'b') // 展开二级
    await clickItem(wrapper, 'c') // 展开三级（待加载）

    expect(wrapper.vm.expandedPath).toEqual(['a', 'b', 'c'])
    // 一、二级子菜单都必须保持可见（此前等长比较 bug 的回归点）
    const aWrap = findItem(wrapper, 'a').element.closest('.dm-item-wrap')
    const bWrap = findItem(wrapper, 'b').element.closest('.dm-item-wrap')
    const aSub = aWrap.querySelector('.dm-sub')
    const bSub = bWrap.querySelector('.dm-sub')
    expect(aSub.style.display).not.toBe('none')
    expect(bSub.style.display).not.toBe('none')
    // 高亮保持
    expect(findItem(wrapper, 'a').classes()).toContain('active')
    expect(findItem(wrapper, 'b').classes()).toContain('active')
  })

  it('点击已展开的节点：收起其整个深层分支，祖先保持', async () => {
    await openMenu(wrapper)
    await clickItem(wrapper, 'a')
    await clickItem(wrapper, 'b')
    expect(wrapper.vm.expandedPath).toEqual(['a', 'b'])

    await clickItem(wrapper, 'b') // 再点 b：收起 b 分支
    expect(wrapper.vm.expandedPath).toEqual(['a'])
    await clickItem(wrapper, 'a') // 再点 a：全部收起
    expect(wrapper.vm.expandedPath).toEqual([])
  })

  it('点击同层兄弟：切换展开并丢弃旧分支深层', async () => {
    await openMenu(wrapper)
    await clickItem(wrapper, 'a')
    await clickItem(wrapper, 'b')
    expect(wrapper.vm.expandedPath).toEqual(['a', 'b'])

    await clickItem(wrapper, 'x') // 一级同层切到待加载的 x
    expect(wrapper.vm.expandedPath).toEqual(['x'])

    await clickItem(wrapper, 'a')
    await clickItem(wrapper, 'b') // 重新展开 a→b
    expect(wrapper.vm.expandedPath).toEqual(['a', 'b'])
    await clickItem(wrapper, 'b2') // 二级同层切到待加载的 b2，b 的深层丢弃
    expect(wrapper.vm.expandedPath).toEqual(['a', 'b2'])
  })

  it('data 整树重赋值：展开状态按 value 链自动保留（v1.2.0 特性）', async () => {
    await openMenu(wrapper)
    await clickItem(wrapper, 'a')
    await clickItem(wrapper, 'b2')
    expect(wrapper.vm.expandedPath).toEqual(['a', 'b2'])

    // 模拟外部整树重建：value 链不变，全部换成新对象
    await wrapper.setProps({ data: makeTree() })
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.expandedPath).toEqual(['a', 'b2'])
    // 新树中 a 的子菜单保持展开，b2 出现在其中
    const aWrap = findItem(wrapper, 'a').element.closest('.dm-item-wrap')
    const aSub = aWrap.querySelector('.dm-sub')
    expect(aSub.style.display).not.toBe('none')
    expect(aSub.textContent).toContain('b2')
  })

  it('禁用项点击不触发任何事件', async () => {
    await openMenu(wrapper)
    await clickItem(wrapper, 'dis')
    expect(wrapper.emitted('expand')).toBeFalsy()
    expect(wrapper.emitted('select')).toBeFalsy()
    expect(wrapper.vm.expandedPath).toEqual([])
  })

  it('加载中连点不会重复触发加载', async () => {
    await openMenu(wrapper)
    await clickItem(wrapper, 'x')
    const node = wrapper.emitted('select')[0][0].path[0]
    wrapper.vm.$set(node, 'loading', true)
    await wrapper.vm.$nextTick()

    await clickItem(wrapper, 'x')
    // loading 中 handleClick 直接 return：select 不重复、展开路径不变
    expect(wrapper.emitted('select').length).toBe(1)
    expect(wrapper.vm.expandedPath).toEqual(['x'])
  })

  it('不同分支同 value 的节点不互相串高亮', async () => {
    const data = [
      {
        label: 'p1', value: 'p1', hasChildren: true,
        children: [{ label: 'dup', value: 'dup', hasChildren: true, children: [{ label: 'deep1', value: 'deep1', hasChildren: false }] }]
      },
      {
        label: 'p2', value: 'p2', hasChildren: true,
        children: [{ label: 'dup2', value: 'dup', hasChildren: true, children: [{ label: 'deep2', value: 'deep2', hasChildren: false }] }]
      }
    ]
    await wrapper.setProps({ data })
    await openMenu(wrapper)
    await clickItem(wrapper, 'p1')
    await clickItem(wrapper, 'dup') // 展开 p1 分支下的 dup

    expect(wrapper.vm.expandedPath).toEqual(['p1', 'dup'])
    // 只有 p1 和 p1 分支的 dup 高亮，p2 分支的 dup 不亮
    expect(findItem(wrapper, 'p1').classes()).toContain('active')
    expect(findItem(wrapper, 'p2').classes()).not.toContain('active')
    expect(findItem(wrapper, 'dup').classes()).toContain('active')
    expect(findItem(wrapper, 'dup2').classes()).not.toContain('active')
  })
})

describe('DropMenuItem（事件 payload 与加载防抖）', () => {
  function mountItem(item, { level = 0, path = [], expandedPath = [], loading = false } = {}) {
    if (loading) item.loading = true
    return mount(DropMenuItem, {
      propsData: { item, level, path, expandedPath }
    })
  }

  it('点击待加载节点：emit expand（含 valuePath/level）+ select', async () => {
    const item = { label: 'x', value: 'x', hasChildren: true, children: [] }
    const wrapper = mountItem(item, { expandedPath: ['x'] })
    await wrapper.find('.dm-item').trigger('click')

    const expand = wrapper.emitted('expand')[0][0]
    expect(expand.item).toBe(item)
    expect(expand.level).toBe(0)
    expect(expand.valuePath).toEqual(['x'])

    const payload = wrapper.emitted('select')[0][0]
    expect(payload.valuePath).toEqual(['x'])
    expect(payload.path[0]).toBe(item)
    wrapper.destroy()
  })

  it('深层节点：valuePath 为根到自身的完整链', async () => {
    const root = { label: 'a', value: 'a', hasChildren: true, children: [] }
    const child = { label: 'b', value: 'b', hasChildren: true, children: [{ label: 'c', value: 'c', hasChildren: true, children: [] }] }
    const wrapper = mountItem(child, { level: 1, path: [root], expandedPath: ['a'] })
    await wrapper.find('.dm-item').trigger('click')

    const expand = wrapper.emitted('expand')[0][0]
    expect(expand.level).toBe(1)
    expect(expand.valuePath).toEqual(['a', 'b'])
    wrapper.destroy()
  })

  it('loading 中点击：不上抛任何事件（防重复加载）', async () => {
    const item = { label: 'x', value: 'x', hasChildren: true, children: [] }
    const wrapper = mountItem(item, { loading: true })
    await wrapper.find('.dm-item').trigger('click')

    expect(wrapper.emitted('expand')).toBeFalsy()
    expect(wrapper.emitted('select')).toBeFalsy()
    wrapper.destroy()
  })

  it('叶子节点：只 emit select，不 emit expand', async () => {
    const item = { label: 'leaf', value: 'leaf', hasChildren: false }
    const wrapper = mountItem(item)
    await wrapper.find('.dm-item').trigger('click')

    expect(wrapper.emitted('expand')).toBeFalsy()
    expect(wrapper.emitted('select').length).toBe(1)
    expect(wrapper.emitted('select')[0][0].valuePath).toEqual(['leaf'])
    wrapper.destroy()
  })

  it('disabled 项点击：不上抛任何事件', async () => {
    const item = { label: 'd', value: 'd', hasChildren: false, disabled: true }
    const wrapper = mountItem(item)
    await wrapper.find('.dm-item').trigger('click')

    expect(wrapper.emitted('select')).toBeFalsy()
    wrapper.destroy()
  })
})

describe('DropMenu 多实例互斥', () => {
  it('打开第二个实例时第一个自动收起', async () => {
    const w1 = mount(DropMenu, { propsData: { title: 'm1', data: makeTree() } })
    const w2 = mount(DropMenu, { propsData: { title: 'm2', data: makeTree() } })

    await w1.find('.dm-trigger').trigger('click')
    expect(w1.find('.dm-panel').isVisible()).toBe(true)

    await w2.find('.dm-trigger').trigger('click')
    expect(w2.find('.dm-panel').isVisible()).toBe(true)
    expect(w1.find('.dm-panel').isVisible()).toBe(false)

    w1.destroy()
    w2.destroy()
  })
})
