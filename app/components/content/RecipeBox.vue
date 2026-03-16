<script setup lang="ts">
defineProps<{
  station?: string
  result?: string
  resultName?: string
  resultIcon?: string
  resultQty?: number | string
}>()
</script>

<template>
  <div class="my-4 border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white max-w-md">
    <!-- Header -->
    <div class="bg-amber-800 border-b-2 border-black px-4 py-2 flex items-center gap-2">
      <span class="text-sm font-bold text-amber-200">Crafted at:</span>
      <span class="font-bold">{{ station || 'Hand Crafting' }}</span>
    </div>

    <!-- Recipe body -->
    <div class="flex items-center gap-4 p-4">
      <!-- Ingredients (slot) -->
      <div class="flex-1 text-sm">
        <span class="text-slate-400 text-xs font-bold block mb-2">INGREDIENTS</span>
        <div class="space-y-1 [&_ul]:list-none [&_ul]:p-0 [&_ul]:m-0 [&_li]:py-0.5 [&_li]:text-slate-200">
          <slot />
        </div>
      </div>

      <!-- Arrow -->
      <div class="text-2xl text-amber-400 font-bold select-none flex-shrink-0">
        &rarr;
      </div>

      <!-- Result -->
      <div class="flex flex-col items-center gap-1 flex-shrink-0">
        <div class="w-16 h-16 bg-slate-900 border-2 border-slate-600 flex items-center justify-center">
          <NuxtImg
            v-if="resultIcon"
            :src="resultIcon"
            :alt="resultName || result || 'Result'"
            width="48"
            height="48"
            class="[image-rendering:pixelated]"
          />
          <span v-else class="text-slate-500 text-xs">?</span>
        </div>
        <span class="text-xs font-bold text-center">{{ resultName || result || 'Result' }}</span>
        <span v-if="resultQty && Number(resultQty) > 1" class="text-xs text-slate-400">
          x{{ resultQty }}
        </span>
      </div>
    </div>
  </div>
</template>
