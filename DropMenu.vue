<template>
  <div class="drop-menu" v-clickoutside="close">
    <button class="dm-trigger" :class="{ active: visible }" @click="toggle">
      <span class="dm-trigger-text">{{ title }}</span>
      <span class="dm-trigger-arrow" :class="{ up: visible }">▾</span>
    </button>
    <div
      v-show="visible"
      ref="panel"
      class="dm-panels"
      :style="{
        '--height': height + 'px',
        left: panelLeft + 'px',
        top: panelTop + 'px'
      }"
    >
      <div
        v-for="panel in panels"
        :key="panel.key"
        class="dm-panel"
        :data-level="panel.level"
      >
        <drop-menu-item
          v-for="item in panel.items"
          :key="item.value"
          :item="item"
          :level="panel.level"
          :path="panel.path"
          :expanded-path="expandedPath"
          @select="onSelect"
          @expand="onExpand"
        >
          <template #label="slotProps">
            <slot name="label" v-bind="slotProps">
              {{ slotProps.item.label }}
            </slot>
          </template>
        </drop-menu-item>
      </div>
    </div>
  </div>
</template>

<script>
  import clickoutside from './clickoutside'
  import { setActive, clearActive } from './activeManager'
  import DropMenuItem from './DropMenuItem.vue'

  export default {
    name: 'DropMenu',
    components: { DropMenuItem },
    directives: { clickoutside },
    props: {
      title: { type: String, required: true },
      data: { type: Array, required: true },
      // 扁平结构下所有列等高，这个值就是每列的实际高度（而非"最大"高度），超出各自滚动
      height: { type: Number, default: 300 }
    },
    data() {
      return {
        visible: false,
        panelLeft: 0,
        panelTop: 0,
        // 当前展开路径：从根到展开节点的 value 链数组（[] 表示全部收起）
        // 唯一的展开状态源，子项根据它纯计算出自身 isActive。存 value 链而非对象引用：
        // data 整树重赋值后引用全部失效，value 链仍能对上新树同链节点、保留展开状态
        expandedPath: []
      }
    },
    computed: {
      // 把展开链（value 数组）解析成"列"数组：第 N 列 = 第 N-1 层激活节点的 children。
      // matched 记录链上能在实际数据中匹配到的层数（待加载层也算已匹配，只是不产生下一列），
      // 供 watcher 在数据重建后裁掉失效的链尾
      resolved() {
        const panels = [{ key: 'root', level: 0, path: [], items: this.data }]
        let items = this.data
        const path = []
        let matched = 0

        for (const value of this.expandedPath) {
          const item = items.find((candidate) => candidate.value === value)
          if (!item) break // 新数据里已无此节点 → 停止匹配
          matched++
          // 待加载层（children 为空）：自身算已匹配，但无下一列，到此为止
          if (!item.children || !item.children.length) break
          path.push(item)
          items = item.children
          panels.push({
            key: path.map((node) => node.value).join('|'),
            level: panels.length,
            path: [...path],
            items
          })
        }
        return { panels, matched }
      },
      panels() {
        return this.resolved.panels
      }
    },
    watch: {
      // 列结构变化（展开/收起，或异步 children 到达而新增一列）→ 容器尺寸变化，需重做视口碰撞定位
      resolved({ matched }) {
        // 数据重建后链尾节点找不到时同步裁剪，避免展开状态与可见列不一致
        if (matched < this.expandedPath.length) {
          this.expandedPath = this.expandedPath.slice(0, matched)
        }
        if (this.visible) this.$nextTick(this.updatePanelContainerPosition)
      }
    },
    mounted() {
      this.$nextTick(() => {
        this.$el._dropMenuPanel = this.$refs.panel
      })
    },
    methods: {
      // 只定位挂载到 body 的外层容器，内部各列由 flex 兄弟布局自动排列。
      // 容器按视口定位，靠右/靠下时翻转到触发器另一侧：
      // 否则超出视口的部分会被外层 overflow:hidden 整列裁掉（表现为"子菜单出不来"）
      updatePanelContainerPosition() {
        const trigger = this.$el && this.$el.querySelector('.dm-trigger')
        const el = this.$refs.panel
        if (!trigger || !el) return
        const rect = trigger.getBoundingClientRect()
        let left = rect.left
        let top = rect.bottom + 4
        // offsetWidth/Height 仅在节点已挂到 body 时非零（游离节点恒为 0），取不到就跳过翻转
        const w = el.offsetWidth
        const h = el.offsetHeight
        if (w && h) {
          if (left + w > window.innerWidth) left = Math.max(0, rect.right - w)
          if (top + h > window.innerHeight) top = Math.max(0, rect.top - h - 4)
        }
        this.panelLeft = left
        this.panelTop = top
        el.style.left = left + 'px'
        el.style.top = top + 'px'
      },
      handleScroll(event) {
        if (event.target && event.target.closest && event.target.closest('.dm-panel')) return
        this.updatePanelContainerPosition()
      },
      addPositionListeners() {
        document.addEventListener('scroll', this.handleScroll, true)
        window.addEventListener('resize', this.updatePanelContainerPosition)
      },
      removePositionListeners() {
        document.removeEventListener('scroll', this.handleScroll, true)
        window.removeEventListener('resize', this.updatePanelContainerPosition)
      },
      appendPanelToBody() {
        // open 与 destroy 落在同一 tick 时，nextTick 的挂载仍会执行；
        // 没有这道闸就会把已销毁组件的容器挂到 body 上，形成永久残留的孤儿节点
        if (this._unmounted) return
        const panel = this.$refs.panel
        if (!panel || panel.parentNode === document.body) {
          this.updatePanelContainerPosition()
          return
        }
        document.body.appendChild(panel)
        this.$el._dropMenuPanel = panel
        this.updatePanelContainerPosition()
      },
      removePanelFromBody() {
        const panel = this.$refs.panel
        if (!panel || panel.parentNode !== document.body) return
        document.body.removeChild(panel)
        this.$el._dropMenuPanel = null
      },
      toggle() {
        this.visible ? this.close() : this.open()
      },
      open() {
        setActive(this) // 互斥：触发其他展开的实例 close
        this.visible = true
        this.addPositionListeners()
        this.$nextTick(this.appendPanelToBody)
      },
      close() {
        this.visible = false
        this.removePositionListeners()
        this.$nextTick(this.removePanelFromBody)
        // 清空展开路径即可，子项的 isActive 随之变 false，无需逐个通知子组件
        this.expandedPath = []
      },
      // 子项 expand：item 为被点节点的原引用，level 为其层级，valuePath 为根到该节点的 value 链
      // 已展开（valuePath 与 expandedPath 前缀逐项相等）：已加载的切换收起（保留祖先展开）；
      //   未加载是异步重试场景，保持展开不动
      // 未展开：直接记住该 value 链 —— 深层旧状态自然丢弃，同层兄弟自然互斥；
      //   之后无论外部原地塞 children 还是整树重赋值 data，子项按链比对都能自动对上并弹出
      onExpand({ item, level, valuePath }) {
        const isSelf = valuePath.every((v, i) => this.expandedPath[i] === v)
        if (isSelf) {
          if (item.children && item.children.length) {
            this.expandedPath = this.expandedPath.slice(0, level)
          }
        } else {
          this.expandedPath = valuePath
        }
      },
      // payload = {...item, path: [祖宗...自身]}
      // 叶子（hasChildren===false）→ emit select + 关闭整个下拉
      // 待加载（hasChildren && children 空）→ emit select 不关闭，外面塞 children 后组件 watch 自动展开
      onSelect(payload) {
        this.$emit('select', payload)
        if (payload.hasChildren === false) {
          this.close()
        }
      }
    },
    beforeDestroy() {
      this._unmounted = true
      this.removePositionListeners()
      this.removePanelFromBody()
      clearActive(this)
    }
  }
</script>

<style scoped>
  .drop-menu {
    position: relative;
    display: inline-block;
  }

  .dm-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #fff;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    color: var(--color-text, #1f2937);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .dm-trigger:hover {
    background: #f3f4f6;
  }

  .dm-trigger.active {
    color: var(--color-side-active, #3b82f6);
    border-color: var(--color-side-active, #3b82f6);
  }

  .dm-trigger-arrow {
    font-size: 12px;
    color: #9ca3af;
    transition: transform 0.2s;
  }

  .dm-trigger-arrow.up {
    transform: rotate(180deg);
  }

  /* 每一级是一列：flex 兄弟并排，各自独立滚动。列与列之间不再有嵌套关系，
     因此不存在"子面板被父级滚动容器裁剪"的问题，也无需 JS 计算列坐标 */
  .dm-panel {
    min-width: 160px;
    width: max-content;
    flex: 0 0 auto;
    height: var(--height, 300px);
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: auto;
    padding: 4px 0;
    background: #fff;
    border-right: 1px solid var(--color-border, #e5e7eb);
  }

  .dm-panel:last-child {
    border-right: 0;
  }

  .dm-panels {
    position: fixed;
    display: flex;
    align-items: flex-start;
    width: max-content;
    height: var(--height, 300px);
    overflow: hidden;
    background: #fff;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    /* 容器挂在 body 下，参与的是 root stacking context。
       写死高值，避免被宿主页面的 fixed 头部/侧边栏/遮罩（常见 1000+）盖住 */
    z-index: 2000;
  }
</style>
