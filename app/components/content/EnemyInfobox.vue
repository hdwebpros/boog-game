<script setup lang="ts">
const props = defineProps<{
  title?: string
  icon?: string
  hp?: number | string
  damage?: number | string
  speed?: number | string
  ai?: string
  biome?: string
  layer?: string
  xp?: number | string
  knockbackResist?: number | string
  special?: string
}>()

const page = inject<Ref<any>>('wiki-page', ref(null))

const p = computed(() => ({
  title: props.title || page.value?.title || 'Unknown',
  icon: props.icon || page.value?.icon || '',
  hp: props.hp ?? page.value?.stats?.hp,
  damage: props.damage ?? page.value?.stats?.damage,
  speed: props.speed ?? page.value?.stats?.speed,
  ai: props.ai || page.value?.stats?.ai || '',
  biome: props.biome || page.value?.stats?.biome || '',
  layer: props.layer || page.value?.stats?.layer || '',
  xp: props.xp ?? page.value?.stats?.xp,
  knockbackResist: props.knockbackResist ?? page.value?.stats?.knockbackResist,
  special: props.special || page.value?.stats?.special || '',
}))

const spriteSrc = computed(() => {
  const icon = p.value.icon
  if (!icon) return ''
  if (icon.startsWith('/')) return icon
  return `/sprites/${icon}`
})

const hpNum = computed(() => Number(p.value.hp ?? 0))
const hpBarWidth = computed(() => {
  const max = 500
  return Math.min((hpNum.value / max) * 100, 100)
})

const stats = computed(() => {
  const rows: { label: string; value: string | number }[] = []
  if (p.value.damage) rows.push({ label: 'Damage', value: p.value.damage })
  if (p.value.speed) rows.push({ label: 'Speed', value: p.value.speed })
  if (p.value.ai) rows.push({ label: 'AI Type', value: p.value.ai })
  if (p.value.biome) rows.push({ label: 'Biome', value: p.value.biome })
  if (p.value.layer) rows.push({ label: 'Layer', value: p.value.layer })
  if (p.value.xp) rows.push({ label: 'XP', value: p.value.xp })
  if (p.value.knockbackResist) rows.push({ label: 'KB Resist', value: p.value.knockbackResist })
  if (p.value.special) rows.push({ label: 'Special', value: p.value.special })
  return rows
})
</script>

<template>
  <div class="max-w-lg mx-auto border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white">
    <!-- Header -->
    <div class="bg-red-900 border-b-2 border-black px-4 py-2">
      <h3 class="text-lg font-bold m-0 text-white">{{ p.title }}</h3>
    </div>

    <!-- Sprite -->
    <div v-if="spriteSrc" class="flex justify-center py-4 bg-slate-900">
      <NuxtImg
        :src="spriteSrc"
        :alt="p.title"
        width="64"
        height="64"
        class="[image-rendering:pixelated]"
      />
    </div>

    <!-- HP Bar -->
    <div v-if="p.hp" class="px-4 py-2 border-b border-slate-600">
      <div class="flex justify-between text-sm mb-1">
        <span class="text-slate-400 font-medium">HP</span>
        <span class="font-bold">{{ p.hp }}</span>
      </div>
      <div class="w-full h-3 bg-slate-900 border border-slate-600">
        <div
          class="h-full bg-red-500"
          :style="{ width: hpBarWidth + '%' }"
        />
      </div>
    </div>

    <!-- Stats -->
    <div class="divide-y divide-slate-600">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="flex justify-between px-4 py-2 text-sm"
      >
        <span class="text-slate-400 font-medium">{{ stat.label }}</span>
        <span class="font-bold">{{ stat.value }}</span>
      </div>
    </div>

    <!-- Drop table slot -->
    <div class="border-t-2 border-black">
      <div class="bg-slate-700 px-4 py-2 border-b border-slate-600">
        <span class="text-sm font-bold text-yellow-400">Drops</span>
      </div>
      <div class="px-4 py-2 text-sm">
        <slot />
      </div>
    </div>
  </div>
</template>
