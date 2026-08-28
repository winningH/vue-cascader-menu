<template>
  <svg
    class="dm-loading-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
</template>

<script>
  // 纯 svg 内联实现（Feather loader-circle），零外部依赖
  export default {
    name: 'LoadingIcon'
  }
</script>

<style scoped>
  .dm-loading-icon {
    display: inline-block;
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }
</style>
