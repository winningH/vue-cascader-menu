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

点击叶子节点或待加载节点时触发。payload = `{ ...item, path: [...] }`：

- `...item`：被点击节点的**自身副本**（不包含 path）
- `path`：从顶层到自身的**原节点引用**数组（可用它直接修改原数据触发响应式）

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

## v1.1.0 变更

- 新增 `max-height` prop、`label` 作用域插槽
- **异步加载的 `loading` 改为外部控制**：组件不再自己维护 loading 状态，由外部在收到待加载节点的 `select` 后设 `item.loading = true`，塞入 children 或失败时设回 `false`（配合 `$set` 保证响应式）。从 1.0.x 升级需按上述示例调整加载逻辑
- 内部重构：展开状态提升为根组件单一数据源，移除逐层 `activeChild` 与父调子的 `resetAll`

## License

MIT
