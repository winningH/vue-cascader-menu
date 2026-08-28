# vue-cascader-menu

Vue 2 多级级联下拉菜单组件：title 触发器 + 级联子菜单（右侧弹出）。支持**异步加载**（hasChildren 且 children 为空时点击触发加载）、**多实例互斥**（同时只允许一个展开）、clickoutside 自动收起、disabled 禁用项。

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
  <drop-menu title="同步数据" :data="menuData" @select="onSelect" />
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

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | String | 是 | 触发器按钮文案 |
| `data` | Array | 是 | 菜单树，节点字段见下 |

节点字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `label` | String | 显示文案 |
| `value` | String \| Number | 唯一标识 |
| `hasChildren` | Boolean | 是否有子级。`false` = 叶子节点 |
| `children` | Array | 子节点数组。`hasChildren:true` 且 `children` 为空表示待异步加载 |
| `disabled` | Boolean | 可选，禁用该项 |

## Events

### `select`

点击叶子节点或待加载节点时触发。payload = `{ ...item, path: [...] }`：

- `...item`：被点击节点的**自身副本**（不包含 path）
- `path`：从顶层到自身的**原节点引用**数组（可用它直接修改原数据触发响应式）

**两种职责（用 `payload.hasChildren` 区分）：**

1. **叶子节点**（`hasChildren === false`）→ 最终选中，组件会自动关闭整个下拉
2. **待加载节点**（`hasChildren === true` 且 `children` 为空）→ 触发异步加载，**不会关闭**。此时把数据塞进 `payload.path[payload.path.length - 1].children`，组件 watch 到 children 变化会自动复位 loading 并展开

```js
onSelect(payload) {
  // 待加载节点：只触发加载，不当作最终选中
  if (payload.hasChildren && (!payload.children || !payload.children.length)) {
    const node = payload.path[payload.path.length - 1] // 原引用，可直接改
    fetchChildren(node.value).then((children) => {
      node.children.splice(0, node.children.length, ...children)
    })
    return
  }
  // 叶子选中
  console.log('选中：', payload.label, payload.path.map((n) => n.label).join(' / '))
}
```

## 特性说明

- **多实例互斥**：页面上多个 DropMenu 同时只允许展开一个，打开新的自动关闭旧的
- **clickoutside 收起**：点击组件外部自动关闭
- **多级滚动**：每层子菜单 `max-height:300px` 独立滚动，子菜单用 `position:fixed` 定位，不受祖先 overflow 裁剪

## License

MIT
