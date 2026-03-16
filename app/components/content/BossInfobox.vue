<script setup lang="ts">
const props = defineProps<{
  title?: string
  icon?: string
  hp?: number | string
  damage?: number | string
  speed?: number | string
  ai?: string
  xp?: number | string
  summonItem?: string
  dropItem?: string
  phases?: number | string
}>()

const page = inject<Ref<any>>('wiki-page', ref(null))

const p = computed(() => ({
  title: props.title || page.value?.title || 'Unknown',
  icon: props.icon || page.value?.icon || '',
  hp: props.hp ?? page.value?.stats?.hp,
  damage: props.damage ?? page.value?.stats?.damage,
  speed: props.speed ?? page.value?.stats?.speed,
  ai: props.ai || page.value?.stats?.ai || '',
  xp: props.xp ?? page.value?.stats?.xp,
  summonItem: props.summonItem || page.value?.stats?.summonItem || '',
  dropItem: props.dropItem || page.value?.stats?.dropItem || '',
  phases: props.phases ?? page.value?.stats?.phases,
}))

const spriteSrc = computed(() => {
  const icon = p.value.icon
  if (!icon) return ''
  if (icon.startsWith('/')) return icon
  return `/sprites/${icon}`
})

const hpNum = computed(() => Number(p.value.hp ?? 0))
const hpBarWidth = computed(() => {
  const max = 5000
  return Math.min((hpNum.value / max) * 100, 100)
})
const phaseCount = computed(() => Number(p.value.phases ?? 1))

const stats = computed(() => {
  const rows: { label: string; value: string | number }[] = []
  if (p.value.damage) rows.push({ label: 'Damage', value: p.value.damage })
  if (p.value.speed) rows.push({ label: 'Speed', value: p.value.speed })
  if (p.value.ai) rows.push({ label: 'AI Type', value: p.value.ai })
  if (p.value.xp) rows.push({ label: 'XP', value: p.value.xp })
  if (p.value.summonItem) rows.push({ label: 'Summon Item', value: p.value.summonItem })
  if (p.value.dropItem) rows.push({ label: 'Drop', value: p.value.dropItem })
  return rows
})
</script>

<template>
  <div class="float-none w-full md:float-right md:w-80 md:ml-6 mb-4 border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white">
    <!-- Header -->
    <div class="bg-purple-900 border-b-2 border-black px-4 py-2">
      <h3 class="text-lg font-bold m-0 text-white">{{ p.title }}</h3>
    </div>

    <!-- Sprite (larger for bosses) -->
    <div v-if="spriteSrc" class="flex justify-center py-4 bg-slate-900">
      <NuxtImg
        :src="spriteSrc"
        :alt="p.title"
        width="96"
        height="96"
        class="[image-rendering:pixelated]"
      />
    </div>

    <!-- HP Bar -->
    <div v-if="p.hp" class="px-4 py-2 border-b border-slate-600">
      <div class="flex justify-between text-sm mb-1">
        <span class="text-slate-400 font-medium">HP</span>
        <span class="font-bold text-red-400">{{ p.hp }}</span>
      </div>
      <div class="w-full h-4 bg-slate-900 border border-slate-600">
        <div
          class="h-full bg-gradient-to-r from-red-600 to-red-400"
          :style="{ width: hpBarWidth + '%' }"
        />
      </div>
    </div>

    <!-- Phase Indicator -->
    <div v-if="p.phases" class="px-4 py-2 border-b border-slate-600">
      <div class="flex justify-between items-center text-sm">
        <span class="text-slate-400 font-medium">Phases</span>
        <div class="flex gap-1">
          <div
            v-for="i in phaseCount"
            :key="i"
            class="w-6 h-6 border-2 border-black flex items-center justify-center text-xs font-bold bg-purple-500 text-white"
          >
            {{ i }}
          </div>
        </div>
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

    <!-- Slot for extra content -->
    <div class="px-4 py-2">
      <slot />
    </div>
  </div>
</template>
