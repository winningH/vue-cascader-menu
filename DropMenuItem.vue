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
      <span class="dm-icon">
        <LoadingIcon v-if="loading" class="dm-spin" />
        <span v-else-if="item.hasChildren" class="dm-arrow">▸</span>
      </span>
    </div>
  </div>
</template>

<script>
  import LoadingIcon from './LoadingIcon.vue'

  export default {
    name: 'DropMenuItem',
    components: { LoadingIcon },
    props: {
      item: { type: Object, required: true },
      level: { type: Number, default: 0 },
      // 祖宗路径：从顶层到父节点的对象数组，顶层传 []
      path: { type: Array, default: () => [] },
      // 当前展开路径（根到展开节点的 value 链数组），由 DropMenu 持有、逐层透传
      expandedPath: { type: Array, default: () => [] }
    },
    computed: {
      // 展开状态按 value 链（根到自身的 value 数组）比对，不比对象引用：
      // 引用在 data 整树重赋值后会失效，value 链对上新树的同链节点即可保留展开状态。
      // 必须比整条链、不能只比本层：不同分支下同 value 的节点要靠祖先链区分。
      // 是前缀比对、不能要求等长：展开深层时祖先必须保持 active（子菜单 v-show 依赖它）
      isActive() {
        const myPath = [...this.path, this.item].map((i) => i.value)
        return myPath.every((v, i) => this.expandedPath[i] === v)
      },
      // loading 是 item 的属性，由外部维护：组件只读不写（遵循单向数据流）
      // 外部 onSelect 收到 select 后设 item.loading=true；成功塞 children 时设 false；失败设 false
      // 组件 computed 响应 item.loading 变化，UI 自动切换转圈/箭头
      loading() {
        return this.item.loading === true
      },
    },
    methods: {
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
  .dm-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    cursor: pointer;
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
    white-space: nowrap;
    word-break: normal;
  }

  /* 右侧图标容器：固定宽高 + 裁剪溢出。旋转的 svg loading 图标绘制区域一旦扫出
     .dm-item 行框，会与相邻 fixed 面板触发 Chromium 合成层 overlap testing 翻转
     （表现为子菜单消失），锁死在行框内根治 */
  .dm-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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

</style>
