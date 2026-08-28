<template>
  <div class="drop-menu" v-clickoutside="close">
    <button class="dm-trigger" :class="{ active: visible }" @click="toggle">
      <span class="dm-trigger-text">{{ title }}</span>
      <span class="dm-trigger-arrow" :class="{ up: visible }">▾</span>
    </button>
    <div v-show="visible" class="dm-panel">
      <drop-menu-item
        v-for="item in data"
        :key="item.value"
        :item="item"
        :level="0"
        :path="[]"
        :is-active="activeChild === item.value"
        @select="onSelect"
        @child-expand="onChildExpand"
      />
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
      data: { type: Array, required: true }
    },
    data() {
      return {
        visible: false,
        // 顶层激活的子项 value（null 表示无子项展开）。子项 emit child-expand 通知更新
        activeChild: null
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
        // 清顶层 active + 递归重置所有子项的 activeChild/loading
        this.activeChild = null
        this.$children.forEach((c) => {
          if (c.$options.name === 'DropMenuItem' && typeof c.resetAll === 'function') {
            c.resetAll()
          }
        })
      },
      // 子项 child-expand：激活/取消激活顶层的 activeChild（再次点同项 → 收起）
      onChildExpand(value) {
        this.activeChild = this.activeChild === value ? null : value
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
    max-height: 300px;
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
