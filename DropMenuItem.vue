<template>
  <div class="dm-item-wrap">
    <div
      ref="item"
      class="dm-item"
      :class="{ disabled: item.disabled, active: isActive }"
      @click="handleClick"
    >
      <span class="dm-label">{{ item.label }}</span>
      <LoadingIcon v-if="loading" class="dm-spin" />
      <span v-else-if="item.hasChildren" class="dm-arrow">▸</span>
    </div>
    <div
      v-show="isActive && item.children && item.children.length"
      class="dm-sub"
      :style="subStyle"
    >
      <drop-menu-item
        v-for="c in item.children"
        :key="c.value"
        :item="c"
        :level="level + 1"
        :path="[...path, item]"
        :is-active="activeChild === c.value"
        @select="$emit('select', $event)"
        @child-expand="onChildExpand"
      />
    </div>
  </div>
</template>

<script>
  import LoadingIcon from './LoadingIcon.vue'

  export default {
    name: 'DropMenuItem', // 递归组件必须声明 name 才能自引用
    components: { LoadingIcon },
    props: {
      item: { type: Object, required: true },
      level: { type: Number, default: 0 },
      // 祖宗路径：从顶层到父节点的对象数组，顶层传 []
      path: { type: Array, default: () => [] },
      // 是否是本层（作为父项时）当前激活的子项——父项传 :is-active="activeChild === c.value"
      isActive: { type: Boolean, default: false }
    },
    data() {
      return {
        // 本层作为父项时，当前激活的子项 value（null 表示无子项展开）
        activeChild: null,
        loading: false,
        // .dm-sub 用 fixed 定位，left/top 由 JS 根据 .dm-item 的 rect 计算
        subLeft: 0,
        subTop: 0
      }
    },
    computed: {
      subStyle() {
        return {
          left: this.subLeft + 'px',
          top: this.subTop + 'px'
        }
      }
    },
    watch: {
      // 被父项激活时（isActive 从 false→true）重算 fixed 坐标
      // 失去激活时清空本层 activeChild：子项的 isActive 会随之变 false，
      // 逐层触发各自的 watcher 级联清空后代的展开状态
      // （否则切走再切回时，后代残留的 activeChild 会让深层子面板一并恢复展开）
      isActive(v) {
        if (v) {
          if (this.item.children && this.item.children.length) {
            this.$nextTick(this.updateSubPos)
          }
        } else if (this.activeChild !== null) {
          this.activeChild = null
        }
      },
      // 异步加载完成（children 从空变非空）→ 复位 loading，若当前激活重算坐标
      'item.children'(v) {
        if (v && v.length) {
          this.loading = false
          if (this.isActive) this.$nextTick(this.updateSubPos)
        }
      }
    },
    methods: {
      // 根据父级面板的 rect 计算 .dm-sub 的 fixed 坐标：弹出在父级面板外面右侧
      // 关键：用父级 .dm-sub/.dm-panel 的 right，不是父项 .dm-item 的 right
      //   - 父级无滚动条：panel.right ≈ item.right，紧贴 panel 右边外侧
      //   - 父级有滚动条：panel.right > item.right（在滚动条外侧），子菜单 z-index:100 覆盖滚动条上方
      //   - ElementUI Cascader 风格：子菜单紧贴父级面板边框外侧，不在面板内部
      // fixed 不受任何祖先 overflow 裁剪，规避级联菜单深层被裁剪问题
      updateSubPos() {
        const itemEl = this.$refs.item
        if (!itemEl) return
        const itemRect = itemEl.getBoundingClientRect()
        // this.$el = .dm-item-wrap，parentElement = 父级 .dm-sub（非顶层）或 .dm-panel（顶层）
        const panelRect = this.$el.parentElement.getBoundingClientRect()
        this.subLeft = panelRect.right
        this.subTop = itemRect.top
      },
      handleClick() {
        if (this.item.disabled) return

        // 回传对象：自身副本 + path（祖宗到自身的原节点引用数组）
        // path 里的元素是原引用，外面异步加载时 payload.path[last].children = [...] 可改原数据
        const payload = { ...this.item, path: [...this.path, this.item] }

        // 叶子节点：emit select，DropMenu 判 hasChildren 后会关闭整个下拉
        if (this.item.hasChildren === false) {
          this.$emit('select', payload)
          return
        }

        const loaded =
          this.item.children && this.item.children.length > 0

        // 待异步加载：通知父项激活自己（让同层兄弟收起）+ emit select 让外部塞 children
        if (!loaded) {
          if (this.loading) return
          this.loading = true
          this.$emit('child-expand', this.item.value)
          this.$emit('select', payload)
          return
        }

        // 已加载：通知父项激活/取消激活（再次点同项会取消）
        this.$emit('child-expand', this.item.value)
      },
      // 子项 child-expand：激活/取消激活本层的 activeChild
      // 再次点同项 → 清掉（实现收起）
      onChildExpand(value) {
        this.activeChild = this.activeChild === value ? null : value
      },
      // 关闭整个面板时由 DropMenu.close() 递归调用，重置所有子项的 activeChild/loading
      resetAll() {
        this.activeChild = null
        this.loading = false
        this.$children.forEach((c) => {
          if (c.$options.name === 'DropMenuItem' && typeof c.resetAll === 'function') {
            c.resetAll()
          }
        })
      }
    }
  }
</script>

<style scoped>
  .dm-item-wrap {
    position: relative;
  }

  .dm-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .dm-item:hover {
    background: #f3f4f6;
  }

  /* 当前激活的 hasChildren 项（同层 active===item.value）高亮，让用户知道展开的是哪个 */
  .dm-item.active {
    background: rgba(59, 130, 246, 0.08);
    color: var(--color-side-active, #3b82f6);
  }

  .dm-item.disabled {
    color: #9ca3af;
    cursor: not-allowed;
  }

  .dm-item.disabled:hover {
    background: transparent;
  }

  .dm-label {
    flex: 1;
  }

  .dm-arrow {
    color: #9ca3af;
    font-size: 12px;
    transition: transform 0.2s;
  }

  .dm-item.active .dm-arrow {
    transform: rotate(90deg);
  }

  /* loading 旋转动画 */
  .dm-spin {
    color: var(--color-side-active, #3b82f6);
    animation: dm-spin 0.6s linear infinite;
  }

  @keyframes dm-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* 子级菜单：position:fixed 规避祖先 overflow 裁剪（级联深层不被父级 .dm-sub 裁剪）
     left/top 由 JS updateSubPos 根据 .dm-item 的 rect 计算（右侧弹出，顶部对齐）
     transform:none 防御性覆盖——若祖先链有 transform 会让 fixed 失效变相对定位 */
  .dm-sub {
    position: fixed;
    /* left/top 由 :style 绑定 */
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
    /* 滚动条空间：内容超出时预留（auto），避免项数少时空滚动条占位挤压内容 */
    scrollbar-gutter: auto;
    transform: none;
    min-width: 140px;
    padding: 4px 0;
    background: #fff;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    z-index: 100;
  }
</style>
