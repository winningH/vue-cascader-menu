# vue-cascader-menu

Vue 2 多级级联下拉菜单组件：title 触发器 + 级联子菜单（右侧弹出）。支持**异步加载**（hasChildren 且 children 为空时点击触发加载）、**多实例互斥**（同时只允许一个展开）、clickoutside 自动收起、disabled 禁用项、自定义 label 插槽。

> 仅支持 Vue 2（^2.6.14），内部为纯 Options API + scoped CSS，无其他依赖。

## 安装

```bash
npm i vue-cascader-menu
```

**必须引入样式**（构建产物为独立 CSS，不会自动注入）：

```js
import 'vue-cascader-menu/style.css'
```

## 用法

```vue
<template>
  <drop-menu title="异步数据" :data="menuData" :max-height="300" @select="onSelect" />
</template>

<script>
  import DropMenu from 'vue-cascader-menu'

  export default {
    components: { DropMenu },
    data() {
      return {
        menuData: [
          {
            label: '文件',
            value: 'file',
            hasChildren: true,
            children: [
              { label: '新建', value: 'new', hasChildren: false },
              { label: '打开', value: 'open', hasChildren: false }
            ]
          },
          {
            label: '待加载',
            value: 'async',
            hasChildren: true,
            children: [] // hasChildren:true 且 children 为空 → 点击时触发异步加载
          },
          { label: '编辑', value: 'edit', hasChildren: false },
          { label: '只读项', value: 'readonly', hasChildren: false, disabled: true }
        ]
      }
    },
    methods: {
      onSelect(payload) {
        // payload = { ...item, path: [祖宗节点...自身节点] }（path 为原节点引用数组）
        console.log(payload.label, payload.path)
      }
    }
  }
</script>
```

## Props（DropMenu）

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | String | 是 | — | 触发器按钮文案 |
| `data` | Array | 是 | — | 菜单树，节点字段见下 |
| `maxHeight` | Number | 否 | `300` | 面板与每层子菜单的最大高度（px），超出滚动 |

节点字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `label` | String | 显示文案 |
| `value` | String \| Number | 唯一标识 |
| `hasChildren` | Boolean | 是否有子级。`false` = 叶子节点 |
| `children` | Array | 子节点数组。`hasChildren:true` 且 `children` 为空表示待异步加载 |
| `disabled` | Boolean | 可选，禁用该项 |
| `loading` | Boolean | 可选，**由外部维护**的加载中标记，见下方异步加载说明 |

## Events

### `select`

点击叶子节点或待加载节点时触发。payload = `{ ...item, path: [...], valuePath: [...] }`：

- `...item`：被点击节点的**自身副本**（不包含 path）
- `path`：从顶层到自身的**原节点引用**数组（可用于直接修改原数据触发响应式，如原地塞 children）
- `valuePath`：从顶层到自身的 **value 链**数组，如 `['file', 'new']`。数据整树重建后引用会失效，value 链是跨数据刷新稳定的身份标识，适合用于记住选中位置、回显高亮、序列化存储

**两种职责（用 `payload.hasChildren` 区分）：**

1. **叶子节点**（`hasChildren === false`）→ 最终选中，组件会自动关闭整个下拉
2. **待加载节点**（`hasChildren === true` 且 `children` 为空）→ 触发异步加载，**不会关闭**

**异步加载流程（loading 由外部控制，组件只读不写）：**

```js
onSelect(payload) {
  // 待加载节点：只触发加载，不当作最终选中
  if (payload.hasChildren && (!payload.children || !payload.children.length)) {
    const node = payload.path[payload.path.length - 1] // 原引用，可直接改
    this.$set(node, 'loading', true) // 组件响应 item.loading 显示转圈
    fetchChildren(node.value).then((children) => {
      node.children.splice(0, node.children.length, ...children)
      this.$set(node, 'loading', false) // 成功：塞 children 并复位 loading，组件自动展开
    }).catch(() => {
      this.$set(node, 'loading', false) // 失败：复位 loading，可再次点击重试
    })
    return
  }
  // 叶子选中
  console.log('选中：', payload.label, payload.path.map((n) => n.label).join(' / '))
}
```

加载完成后子菜单自动展开；加载失败复位 loading 后可点击重试（重试不会把已展开的项收起）。

**children 的两种回填方式（组件都兼容，按场景二选一，不要混用）：**

1. **原地修改**（推荐，改动最小）：持有 `payload.path[last]` 原引用，直接 `node.children = [...]`，Vue 响应式自动驱动更新
2. **整树重赋值**：把新加载的 children 合进整棵树后 `this.data = newTree`。展开状态内部按 **value 链**记录（不依赖对象引用），新树渲染后同链节点自动对上、保持展开并弹出子菜单，loading 则需要在**新树**的对应节点上设置

注意：若在 `select` 回调里持着旧 `payload.path` 改引用、随后又整树赋值，改的是已不在树上的死对象，两种方式不要混用。

## Slots

### `label`

自定义每层菜单项的渲染，作用域插槽参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `item` | Object | 当前节点 |
| `level` | Number | 层级（顶层为 0） |
| `path` | Array | 从顶层到自身的原节点引用数组 |

```vue
<drop-menu title="自定义 label" :data="menuData" @select="onSelect">
  <template #label="{ item, level }">
    <strong>{{ item.label }}</strong>
    <small v-if="item.hasChildren">菜单</small>
  </template>
</drop-menu>
```

## 交互行为

- **展开/收起**：点击有子级的项展开下一级（右侧弹出），再次点击同项收起（祖先保持展开），点击同层兄弟项自动切换并收起旧分支的深层展开
- **多实例互斥**：页面上多个 DropMenu 同时只允许展开一个，打开新的自动关闭旧的
- **clickoutside 收起**：点击组件外部自动关闭，关闭后展开状态整体重置
- **多级滚动**：每层子菜单独立滚动（`maxHeight`），子菜单用 `position:fixed` 定位，不受祖先 overflow 裁剪
- **数据刷新不丢展开状态**：展开状态按 value 链记录，`data` 整树重赋值后，只要新树里存在相同 value 链的节点，展开位置自动保留（要求同一父级下 value 唯一，与 `:key="item.value"` 的既有要求一致）

## v1.2.3 变更

- **滚动/缩放跟随**：面板挂载 body 后为视口定位，现监听 `scroll`（捕获任意祖先容器滚动）与 `resize`，实时重算根面板与各级已展开子菜单的位置——页面滚动、面板内部滚动、窗口缩放时菜单不再脱离触发器
- 对外 API 无变化，从 1.2.2 升级无需调整代码

## v1.2.2 变更

- **面板挂载到 `document.body`**：打开时 `.dm-panel` 移至 body 下（`position:fixed`，按触发器位置定位），关闭时移回。菜单不再受宿主页面祖先元素的 overflow 裁剪、transform/zoom 等渲染上下文影响——修复特定框架环境下点击展开时子菜单"消失"的合成层渲染问题（重叠测试翻转）
- `clickoutside` 同步适配：点击 body 上的面板不再被判定为外部点击
- 已知行为变化：面板打开期间页面滚动时，面板固定于视口位置，不再跟随触发器滚动
- 对外 API（props、事件、插槽）无变化，从 1.2.x 升级无需调整代码

## v1.2.1 变更

- **修复子菜单"消失"的渲染 bug**：loading 旋转图标的 transform 动画在绘制区域超出 `.dm-item` 行框时，会与相邻的 `position:fixed` 子面板触发 Chromium 合成层 overlap testing 翻转（小数像素边界贴合时），表现为点击展开下一级时子菜单闪失。现箭头与 loading 图标包裹在固定 16×16、`overflow: hidden` 的 `.dm-icon` 容器内，绘制区域锁定在行框中，不再触发
- 对外 API、DOM 结构（`.dm-arrow`/`.dm-spin` 类名保留）与视觉均无变化，从 1.2.0 升级无需调整代码

## v1.2.0 变更

- **展开状态的内部判据从"对象引用相等"改为"value 链比对"**：`data` 在下拉展开期间整树重赋值不再导致展开状态静默塌掉、异步加载后子菜单不再丢失自动弹出；原地修改 children/loading 的用法行为不变
- `select` 事件 payload 新增 `valuePath` 字段（根到被点节点的 value 数组），供外部跨数据刷新记住选中位置/回显；原 `path`（引用数组）保留，用途不变
- 对外 API（props、事件名、插槽）无破坏性变化，从 1.1.x 升级无需调整代码

## v1.1.0 变更

- 新增 `max-height` prop、`label` 作用域插槽
- **异步加载的 `loading` 改为外部控制**：组件不再自己维护 loading 状态，由外部在收到待加载节点的 `select` 后设 `item.loading = true`，塞入 children 或失败时设回 `false`（配合 `$set` 保证响应式）。从 1.0.x 升级需按上述示例调整加载逻辑
- 内部重构：展开状态提升为根组件单一数据源，移除逐层 `activeChild` 与父调子的 `resetAll`

## 开发

```bash
npm install
npm test        # 运行单元测试（vitest + @vue/test-utils，18 个用例）
npm run build   # 构建产物
```

测试覆盖（`__tests__/DropMenu.test.js`）：面板开合、叶子选中与 select payload（path/valuePath）、待加载节点 expand/select 流程、外部 `$set` 原节点 children 后自动展开、逐级展开祖先保持激活、收起深层分支、同层切换互斥、**data 整树重赋值保留展开状态**、异分支同 value 不串高亮、disabled 拦截、loading 防重复触发、多实例互斥。`preversion`/`prepublishOnly` 会自动先跑测试再构建发版。

## License

MIT
