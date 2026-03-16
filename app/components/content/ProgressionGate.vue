<script setup lang="ts">
defineProps<{
  requires: string
}>()
</script>

<template>
  <div class="my-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-900 border-2 border-black shadow-[2px_2px_0_black] text-amber-200 text-sm font-bold">
    <span class="text-amber-400 text-lg leading-none">!</span>
    <span>Requires: {{ requires }}</span>
  </div>
</template>
