<script setup lang="ts">
defineProps<{
  title: string
  category?: string
}>()

const categoryColors: Record<string, string> = {
  weapons: 'bg-red-800',
  tools: 'bg-amber-800',
  armor: 'bg-blue-800',
  materials: 'bg-green-800',
  consumables: 'bg-pink-800',
  blocks: 'bg-stone-700',
  accessories: 'bg-purple-800',
  bosses: 'bg-purple-900',
  enemies: 'bg-red-900',
  biomes: 'bg-emerald-800',
  stations: 'bg-amber-900',
}
</script>

<template>
  <div class="my-6 border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white">
    <!-- Category header bar -->
    <div
      class="border-b-2 border-black px-4 py-2"
      :class="categoryColors[category?.toLowerCase() ?? ''] || 'bg-slate-700'"
    >
      <span class="font-bold text-white">{{ title }}</span>
    </div>

    <!-- Link grid -->
    <div
      class="p-3
             [&_ul]:list-none [&_ul]:p-0 [&_ul]:m-0
             [&_ul]:grid [&_ul]:grid-cols-2 [&_ul]:sm:grid-cols-3 [&_ul]:md:grid-cols-4 [&_ul]:gap-1
             [&_li]:p-0 [&_li]:m-0
             [&_a]:block [&_a]:px-2 [&_a]:py-1.5 [&_a]:text-sm [&_a]:text-slate-300
             [&_a:hover]:bg-slate-700 [&_a:hover]:text-white [&_a]:no-underline [&_a]:border [&_a]:border-slate-700"
    >
      <slot />
    </div>
  </div>
</template>
