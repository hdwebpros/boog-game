<script setup lang="ts">
const props = defineProps<{
  title?: string
  icon?: string
  tier?: number | string
  craftedAt?: string
  recipes?: string
}>()

const page = inject<Ref<any>>('wiki-page', ref(null))

const p = computed(() => ({
  title: props.title || page.value?.title || 'Unknown',
  icon: props.icon || page.value?.icon || '',
  tier: props.tier ?? page.value?.tier,
  craftedAt: props.craftedAt || page.value?.craftedAt || '',
  recipes: props.recipes || '',
}))

const spriteSrc = computed(() => {
  const icon = p.value.icon
  if (!icon) return ''
  if (icon.startsWith('/')) return icon
  return `/sprites/${icon}`
})

const tierColors: Record<number, string> = {
  0: 'bg-gray-500',
  1: 'bg-green-500',
  2: 'bg-blue-500',
  3: 'bg-purple-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
  6: 'bg-yellow-400 text-black',
}

const tierNames: Record<number, string> = {
  0: 'Basic',
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Epic',
  5: 'Legendary',
  6: 'Mythic',
}

const tierNum = computed(() => Number(p.value.tier ?? 0))
const recipeList = computed(() =>
  p.value.recipes ? p.value.recipes.split(',').map((s: string) => s.trim()).filter(Boolean) : []
)
</script>

<template>
  <div class="max-w-lg mx-auto border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white">
    <!-- Header -->
    <div class="bg-amber-800 border-b-2 border-black px-4 py-2">
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

    <!-- Tier badge -->
    <div v-if="p.tier !== undefined" class="flex justify-center py-2 border-b border-slate-600">
      <span
        class="px-3 py-1 text-sm font-bold border-2 border-black text-white"
        :class="tierColors[tierNum] || 'bg-gray-500'"
      >
        Tier {{ tierNum }} &mdash; {{ tierNames[tierNum] || 'Unknown' }}
      </span>
    </div>

    <!-- Crafted At -->
    <div v-if="p.craftedAt" class="flex justify-between px-4 py-2 text-sm border-b border-slate-600">
      <span class="text-slate-400 font-medium">Crafted At</span>
      <span class="font-bold">{{ p.craftedAt }}</span>
    </div>

    <!-- Recipes list -->
    <div v-if="recipeList.length" class="px-4 py-2">
      <span class="text-sm text-amber-400 font-bold block mb-2">Can Craft</span>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="recipe in recipeList"
          :key="recipe"
          class="text-xs px-2 py-0.5 bg-amber-900 border border-amber-700 text-amber-200"
        >
          {{ recipe }}
        </span>
      </div>
    </div>

    <div class="px-4 py-2">
      <slot />
    </div>
  </div>
</template>
