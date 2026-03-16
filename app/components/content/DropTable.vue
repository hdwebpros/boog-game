<script setup lang="ts">
</script>

<template>
  <div class="my-4 border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white max-w-lg">
    <!-- Header -->
    <div class="bg-yellow-700 border-b-2 border-black px-4 py-2">
      <span class="font-bold text-yellow-200">Drops</span>
    </div>

    <!-- Table content -->
    <div
      class="[&_table]:w-full [&_table]:text-sm [&_table]:border-collapse
             [&_thead]:bg-slate-700
             [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-slate-300 [&_th]:font-bold [&_th]:border-b-2 [&_th]:border-slate-600
             [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-slate-700
             [&_tr:nth-child(even)]:bg-slate-750
             [&_tr:nth-child(odd)]:bg-slate-800
             [&_tr:hover]:bg-slate-700"
    >
      <slot />
    </div>
  </div>
</template>
