<template>
  <div class="drop-menu" v-clickoutside="close">
    <button class="dm-trigger" :class="{ active: visible }" @click="toggle">
      <span class="dm-trigger-text">{{ title }}</span>
      <span class="dm-trigger-arrow" :class="{ up: visible }">▾</span>
    </button>
    <div v-show="visible" ref="panel" class="dm-panels">
      <div
        v-for="panel in panels"
        :key="panel.key"
        class="dm-panel"
        :data-level="panel.level"
        :style="{ '--maxHeight': maxHeight + 'px' }"
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
      maxHeight: { type: Number, default: 300 }
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
      panels() {
        const result = [{ key: 'root', level: 0, path: [], items: this.data }]
        let items = this.data
        const path = []

        this.expandedPath.forEach((value, level) => {
          const item = items.find((candidate) => candidate.value === value)
          if (!item || !item.children || !item.children.length) return
          path.push(item)
          items = item.children
          result.push({
            key: path.map((node) => node.value).join('|'),
            level: level + 1,
            path: [...path],
            items
          })
        })
        return result
      }
    },
    watch: {
      expandedPath() {
        if (this.visible) this.$nextTick(this.updateMenuPositions)
      },
      data: {
        deep: true,
        handler() {
          if (this.visible) {
            this.$nextTick(() => this.$nextTick(this.updateMenuPositions))
          }
        }
      }
    },
    mounted() {
      this.$nextTick(() => {
        this.$el._dropMenuPanel = this.$refs.panel
      })
    },
    updated() {
      if (this.visible) this.updateMenuPositions()
    },
    methods: {
      updatePanelPos() {
        const trigger = this.$el && this.$el.querySelector('.dm-trigger')
        if (!trigger) return
        const rect = trigger.getBoundingClientRect()
        this.panelLeft = rect.left
        this.panelTop = rect.bottom + 4
        const panel = this.$refs.panel
        const rootPanel = panel && panel.querySelector('.dm-panel[data-level="0"]')
        if (rootPanel) {
          rootPanel.style.left = this.panelLeft + 'px'
          rootPanel.style.top = this.panelTop + 'px'
        }
      },
      updateMenuPositions() {
        if (!this.visible) return
        // 根面板定位已在 updatePanelPos 内完成，这里只处理 level>=1 的横向排布
        this.updatePanelPos()
        const panel = this.$refs.panel
        if (!panel) return

        for (let level = 1; level < this.panels.length; level += 1) {
          const previousPanel = panel.querySelector(
            `.dm-panel[data-level='${level - 1}']`
          )
          if (!previousPanel) continue
          const panelRect = previousPanel.getBoundingClientRect()
          const currentPanel = panel.querySelector(
            `.dm-panel[data-level='${level}']`
          )
          if (!currentPanel) continue
          currentPanel.style.left = panelRect.right + 'px'
          currentPanel.style.top = this.panelTop + 'px'
        }
      },
      handleScroll(event) {
        if (event.target && event.target.closest && event.target.closest('.dm-panel')) return
        this.updateMenuPositions()
      },
      addPositionListeners() {
        document.addEventListener('scroll', this.handleScroll, true)
        window.addEventListener('resize', this.updateMenuPositions)
      },
      removePositionListeners() {
        document.removeEventListener('scroll', this.handleScroll, true)
        window.removeEventListener('resize', this.updateMenuPositions)
      },
      appendPanelToBody() {
        const panel = this.$refs.panel
        if (!panel || panel.parentNode === document.body) {
          this.updatePanelPos()
          return
        }
        document.body.appendChild(panel)
        this.$el._dropMenuPanel = panel
        this.updatePanelPos()
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

  .dm-panel {
    position: fixed;
    left: 0;
    top: 0;
    min-width: 160px;
    width: max-content;
    flex: 0 0 auto;
    height: var(--maxHeight, 300px);
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: auto;
    padding: 4px 0;
    background: #fff;
    border: 1px solid var(--color-border, #e5e7eb);
    /* 多列并排时边框合并为一根（后续列左移 1px 压在前列边框上），仅首末列保留外侧圆角 */
    border-radius: 0;
    margin-left: -1px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    z-index: 100;
  }

  .dm-panel:first-child {
    margin-left: 0;
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
  }

  .dm-panel:last-child {
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
  }

  .dm-panels {
    position: static;
  }
</style>
