<template>
  <div class="dm-item-wrap">
    <div
      ref="item"
      class="dm-item"
      :class="{ disabled: item.disabled, active: isActive }"
      @click="handleClick"
    >
      <span class="dm-label">
        <slot name="label" :item="item" :level="level" :path="[...path, item]">
          {{ item.label }}
        </slot>
      </span>
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
        :expanded-path="expandedPath"
        @select="$emit('select', $event)"
        @expand="$emit('expand', $event)"
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
  import LoadingIcon from './LoadingIcon.vue'

  export default {
    name: 'DropMenuItem', // 递归组件必须声明 name 才能自引用
    components: { LoadingIcon },
    props: {
      item: { type: Object, required: true },
      level: { type: Number, default: 0 },
      // 祖宗路径：从顶层到父节点的对象数组，顶层传 []
      path: { type: Array, default: () => [] },
      // 当前展开路径（根到展开节点的 value 链数组），由 DropMenu 持有、逐层透传
      expandedPath: { type: Array, default: () => [] }
    },
    data() {
      return {
        // .dm-sub 用 fixed 定位，left/top 由 JS 根据 .dm-item 的 rect 计算
        subLeft: 0,
        subTop: 0
      }
    },
    computed: {
      // 展开状态按 value 链（根到自身的 value 数组）比对，不比对象引用：
      // 引用在 data 整树重赋值后会失效，value 链对上新树的同链节点即可保留展开状态。
      // 必须比整条链、不能只比本层：不同分支下同 value 的节点要靠祖先链区分
      isActive() {
        const myPath = [...this.path, this.item].map((i) => i.value)
        return (
          myPath.length === this.expandedPath.length &&
          myPath.every((v, i) => this.expandedPath[i] === v)
        )
      },
      // loading 是 item 的属性，由外部维护：组件只读不写（遵循单向数据流）
      // 外部 onSelect 收到 select 后设 item.loading=true；成功塞 children 时设 false；失败设 false
      // 组件 computed 响应 item.loading 变化，UI 自动切换转圈/箭头
      loading() {
        return this.item.loading === true
      },
      subStyle() {
        return {
          left: this.subLeft + 'px',
          top: this.subTop + 'px'
        }
      }
    },
    watch: {
      // 被激活时（isActive 从 false→true）重算 fixed 坐标
      // 失活无需任何清理：展开状态由根的 expandedPath 单点持有，收起/切换时自然覆盖
      isActive(v) {
        if (v && this.item.children && this.item.children.length) {
          this.$nextTick(this.updateSubPos)
        }
      },
      // 异步加载完成（children 从空变非空）→ 若当前激活重算坐标
      // loading 复位由外部控制（外部塞 children 时自己设 item.loading=false）
      'item.children'(v) {
        if (v && v.length && this.isActive) {
          this.$nextTick(this.updateSubPos)
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

        // value 链：根到自身的 value 数组，是跨数据重建稳定的身份标识
        const valuePath = [...this.path, this.item].map((i) => i.value)

        // 回传对象：自身副本 + path（祖宗到自身的原节点引用数组）+ valuePath
        // path 里的元素是原引用，外面原地加载时 payload.path[last].children = [...] 可改原数据；
        // valuePath 供外部跨数据刷新记住选中位置（引用在整树重赋值后会失效，value 链不会）
        const payload = { ...this.item, path: [...this.path, this.item], valuePath }

        // 叶子节点：emit select，DropMenu 判 hasChildren 后会关闭整个下拉
        if (this.item.hasChildren === false) {
          this.$emit('select', payload)
          return
        }

        const loaded =
          this.item.children && this.item.children.length > 0

        // 待异步加载：emit select 让外部塞 children 并由外部设 item.loading=true（单向数据流）
        if (!loaded) {
          if (this.loading) return // 防首次连点高频触发（重试场景外部已设 loading=true）
          this.$emit('expand', { item: this.item, level: this.level, valuePath })
          this.$emit('select', payload)
          return
        }

        // 已加载/待加载统一上抛，是否切换收起由 DropMenu 依据当前 expandedPath 和 children 判断
        this.$emit('expand', { item: this.item, level: this.level, valuePath })
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
    /* --maxHeight 由顶层 .dm-panel 的内联样式设置，自定义属性沿 DOM 继承到各层 .dm-sub */
    max-height: var(--maxHeight, 300px);
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
