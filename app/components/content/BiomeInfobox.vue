<script setup lang="ts">
const props = defineProps<{
  title?: string
  icon?: string
  layer?: string
  yMin?: number | string
  yMax?: number | string
  enemies?: string
  resources?: string
}>()

const page = inject<Ref<any>>('wiki-page', ref(null))

const p = computed(() => ({
  title: props.title || page.value?.title || 'Unknown',
  icon: props.icon || page.value?.icon || '',
  layer: props.layer || page.value?.stats?.layer || '',
  yMin: props.yMin ?? page.value?.stats?.yMin,
  yMax: props.yMax ?? page.value?.stats?.yMax,
  enemies: props.enemies || page.value?.stats?.enemies || '',
  resources: props.resources || page.value?.stats?.resources || '',
}))

const spriteSrc = computed(() => {
  const icon = p.value.icon
  if (!icon) return ''
  if (icon.startsWith('/')) return icon
  return `/sprites/${icon}`
})

const layerColors: Record<string, string> = {
  'Sky': 'bg-cyan-500',
  'Surface': 'bg-green-500',
  'Ocean': 'bg-blue-500',
  'Underground': 'bg-amber-700',
  'Deep Underground': 'bg-gray-600',
  'Core': 'bg-red-700',
  'Void': 'bg-purple-700',
}

const enemyList = computed(() =>
  p.value.enemies ? p.value.enemies.split(',').map((s: string) => s.trim()).filter(Boolean) : []
)
const resourceList = computed(() =>
  p.value.resources ? p.value.resources.split(',').map((s: string) => s.trim()).filter(Boolean) : []
)
</script>

<template>
  <div class="md:w-72 md:ml-6 mb-4 border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white">
    <!-- Header -->
    <div class="bg-emerald-800 border-b-2 border-black px-4 py-2">
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

    <!-- Layer badge -->
    <div v-if="p.layer" class="flex justify-center py-2 border-b border-slate-600">
      <span
        class="px-3 py-1 text-sm font-bold border-2 border-black text-white"
        :class="layerColors[p.layer] || 'bg-slate-500'"
      >
        {{ p.layer }}
      </span>
    </div>

    <!-- Depth range -->
    <div v-if="p.yMin || p.yMax" class="flex justify-between px-4 py-2 text-sm border-b border-slate-600">
      <span class="text-slate-400 font-medium">Depth Range</span>
      <span class="font-bold">{{ p.yMin ?? '?' }} &ndash; {{ p.yMax ?? '?' }}</span>
    </div>

    <!-- Enemies -->
    <div v-if="enemyList.length" class="px-4 py-2 border-b border-slate-600">
      <span class="text-sm text-red-400 font-bold block mb-1">Enemies</span>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="enemy in enemyList"
          :key="enemy"
          class="text-xs px-2 py-0.5 bg-red-900 border border-red-700 text-red-200"
        >
          {{ enemy }}
        </span>
      </div>
    </div>

    <!-- Resources -->
    <div v-if="resourceList.length" class="px-4 py-2">
      <span class="text-sm text-blue-400 font-bold block mb-1">Resources</span>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="resource in resourceList"
          :key="resource"
          class="text-xs px-2 py-0.5 bg-blue-900 border border-blue-700 text-blue-200"
        >
          {{ resource }}
        </span>
      </div>
    </div>

    <div class="px-4 py-2">
      <slot />
    </div>
  </div>
</template>
