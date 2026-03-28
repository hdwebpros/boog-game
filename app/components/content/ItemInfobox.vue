<script setup lang="ts">
const props = defineProps<{
  title?: string
  icon?: string
  tier?: number | string
  category?: string
  subcategory?: string
  damage?: number | string
  defense?: number | string
  weaponStyle?: string
  attackSpeed?: string
  manaCost?: number | string
  miningSpeed?: number | string
  miningTier?: number | string
  stackSize?: number | string
  healAmount?: number | string
  projectileSpeed?: number | string
  craftedAt?: string
  buyPrice?: number | string
  sellPrice?: number | string
}>()

// Auto-read from page frontmatter if props not explicitly passed
const page = inject<Ref<any>>('wiki-page', ref(null))

const p = computed(() => ({
  title: props.title || page.value?.title || 'Unknown',
  icon: props.icon || page.value?.icon || '',
  tier: props.tier ?? page.value?.tier,
  category: props.category || page.value?.category || '',
  subcategory: props.subcategory || page.value?.subcategory || '',
  damage: props.damage ?? page.value?.stats?.damage,
  defense: props.defense ?? page.value?.stats?.defense,
  weaponStyle: props.weaponStyle || page.value?.stats?.weaponStyle || '',
  attackSpeed: props.attackSpeed || page.value?.stats?.attackSpeed || '',
  manaCost: props.manaCost ?? page.value?.stats?.manaCost,
  miningSpeed: props.miningSpeed ?? page.value?.stats?.miningSpeed,
  miningTier: props.miningTier ?? page.value?.stats?.miningTier,
  stackSize: props.stackSize ?? page.value?.stats?.stackSize,
  healAmount: props.healAmount ?? page.value?.stats?.healAmount,
  projectileSpeed: props.projectileSpeed ?? page.value?.stats?.projectileSpeed,
  craftedAt: props.craftedAt || page.value?.craftedAt || '',
  buyPrice: props.buyPrice ?? page.value?.stats?.buyPrice,
  sellPrice: props.sellPrice ?? page.value?.stats?.sellPrice,
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

const stats = computed(() => {
  const rows: { label: string; value: string | number }[] = []
  if (p.value.category) rows.push({ label: 'Category', value: p.value.category })
  if (p.value.subcategory) rows.push({ label: 'Type', value: p.value.subcategory })
  if (p.value.damage) rows.push({ label: 'Damage', value: p.value.damage })
  if (p.value.defense) rows.push({ label: 'Defense', value: p.value.defense })
  if (p.value.weaponStyle) rows.push({ label: 'Style', value: p.value.weaponStyle })
  if (p.value.attackSpeed) rows.push({ label: 'Attack Speed', value: p.value.attackSpeed })
  if (p.value.manaCost) rows.push({ label: 'Mana Cost', value: p.value.manaCost })
  if (p.value.miningSpeed) rows.push({ label: 'Mining Speed', value: `${p.value.miningSpeed}x` })
  if (p.value.miningTier) rows.push({ label: 'Mining Tier', value: p.value.miningTier })
  if (p.value.healAmount) rows.push({ label: 'Heal', value: p.value.healAmount })
  if (p.value.projectileSpeed) rows.push({ label: 'Proj. Speed', value: p.value.projectileSpeed })
  if (p.value.stackSize) rows.push({ label: 'Stack Size', value: p.value.stackSize })
  if (p.value.craftedAt) rows.push({ label: 'Crafted At', value: p.value.craftedAt })
  if (p.value.buyPrice) rows.push({ label: 'Buy Price', value: `${p.value.buyPrice} coins` })
  if (p.value.sellPrice) rows.push({ label: 'Sell Price', value: `${p.value.sellPrice} coins` })
  return rows
})
</script>

<template>
  <div class="max-w-lg mx-auto border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white">
    <!-- Header -->
    <div class="bg-slate-700 border-b-2 border-black px-4 py-2">
      <h3 class="text-lg font-bold m-0 text-white">{{ p.title }}</h3>
    </div>

    <!-- Sprite -->
    <div v-if="spriteSrc" class="flex justify-center py-4 bg-slate-900">
      <NuxtImg
        :src="spriteSrc"
        :alt="p.title"
        width="64"
        height="64"
        class="w-16 h-16 [image-rendering:pixelated]"
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
