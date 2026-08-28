import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'index.js',
      name: 'VueCascaderMenu', // UMD 全局变量名
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'vue-cascader-menu.js' : 'vue-cascader-menu.umd.cjs')
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
        exports: 'named'
      }
    }
  }
})
