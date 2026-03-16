<script setup lang="ts">
defineProps<{
  title?: string
}>()

const revealed = ref(false)
</script>

<template>
  <div class="my-4 border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white">
    <!-- Toggle header -->
    <button
      class="w-full flex items-center justify-between px-4 py-2 bg-slate-700 border-b-2 border-black text-left cursor-pointer hover:bg-slate-600 transition-colors"
      @click="revealed = !revealed"
    >
      <span class="font-bold text-sm text-slate-300">{{ title || 'Spoiler' }}</span>
      <span class="text-xs text-slate-400">{{ revealed ? 'Click to hide' : 'Click to reveal' }}</span>
    </button>

    <!-- Content -->
    <div
      class="px-4 py-3 text-sm transition-all duration-200"
      :class="revealed ? 'opacity-100' : 'opacity-0 blur-sm select-none pointer-events-none max-h-24 overflow-hidden'"
    >
      <slot />
    </div>
  </div>
</template>
