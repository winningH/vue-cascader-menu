<template>
  <div class="drop-menu" v-clickoutside="close">
    <button class="dm-trigger" :class="{ active: visible }" @click="toggle">
      <span class="dm-trigger-text">{{ title }}</span>
      <span class="dm-trigger-arrow" :class="{ up: visible }">▾</span>
    </button>
    <div v-show="visible" class="dm-panel" :style="{ '--maxHeight': maxHeight + 'px' }">
      <drop-menu-item
        v-for="item in data"
        :key="item.value"
        :item="item"
        :level="0"
        :path="[]"
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
        // 当前展开路径：从顶层到展开节点的原节点对象引用数组（[] 表示全部收起）
        // 唯一的展开状态源，子项根据它纯计算出自身 isActive；点击时子项上抛 { item, level }，这里统一 toggle
        expandedPath: []
      }
    },
    methods: {
      toggle() {
        this.visible ? this.close() : this.open()
      },
      open() {
        setActive(this) // 互斥：触发其他展开的实例 close
        this.visible = true
      },
      close() {
        this.visible = false
        // 清空展开路径即可，子项的 isActive 随之变 false，无需逐个通知子组件
        this.expandedPath = []
      },
      // 子项 expand：item 为被点节点的原引用，level 为其层级
      // 已展开（expandedPath[level] === item）：已加载的切换收起（保留祖先展开）；
      //   未加载是异步重试场景，保持展开不动
      // 未展开：截取前 level 项后接上 item —— 深层旧状态自然丢弃，同层兄弟自然互斥
      onExpand({ item, level }) {
        if (this.expandedPath[level] === item) {
          if (item.children && item.children.length) {
            this.expandedPath = this.expandedPath.slice(0, level)
          }
        } else {
          this.expandedPath = [...this.expandedPath.slice(0, level), item]
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
    position: absolute;
    left: 0;
    top: calc(100% + 4px);
    min-width: 160px;
    max-height: var(--maxHeight, 300px);
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: auto;
    padding: 4px 0;
    background: #fff;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    z-index: 100;
  }
</style>
