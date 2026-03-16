<template>
  <div>
    <!-- Hero -->
    <section class="text-center mb-10">
      <h1 class="font-heading text-2xl md:text-3xl text-wiki-primary mb-4">Starfall Wiki</h1>
      <p class="text-gray-400 max-w-xl mx-auto text-sm">
        Your guide to surviving the crash, defeating the bosses, and escaping the planet.
      </p>
    </section>

    <!-- Category Grid -->
    <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      <NuxtLink
        v-for="cat in categories"
        :key="cat.slug"
        :to="`/wiki/${cat.slug}`"
        class="neo bg-slate-800 p-4 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
      >
        <div class="text-3xl mb-2">{{ cat.icon }}</div>
        <h2 class="font-heading text-xs" :style="{ color: cat.color }">{{ cat.label }}</h2>
        <p class="text-gray-500 text-xs mt-1">{{ cat.description }}</p>
      </NuxtLink>
    </section>

    <!-- Tip of the Day -->
    <section class="neo bg-slate-800 p-6">
      <h3 class="font-heading text-xs text-wiki-accent mb-3">Tip of the Day</h3>
      <p class="text-sm text-gray-300">{{ currentTip }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'wiki',
})

useHead({
  title: 'Starfall Wiki',
  meta: [
    { name: 'description', content: 'The complete guide to Starfall — items, enemies, bosses, biomes, crafting, and more.' },
  ],
})

const categories = [
  { slug: 'items', label: 'Items', icon: '\u2694', color: '#facc15', description: 'Weapons, tools, materials, and accessories.' },
  { slug: 'enemies', label: 'Enemies', icon: '\uD83D\uDC7E', color: '#f87171', description: '20+ hostile creatures across all biomes.' },
  { slug: 'bosses', label: 'Bosses', icon: '\uD83D\uDC80', color: '#c084fc', description: '6 bosses + the Void Lord final boss.' },
  { slug: 'biomes', label: 'Biomes', icon: '\uD83C\uDF0D', color: '#34d399', description: '8 surface biomes and underground layers.' },
  { slug: 'crafting', label: 'Crafting', icon: '\uD83D\uDD28', color: '#60a5fa', description: 'Recipes, stations, and material tiers.' },
  { slug: 'skills', label: 'Skills', icon: '\u2B50', color: '#fb923c', description: 'Skill trees and God Tier abilities.' },
  { slug: 'guides', label: 'Guides', icon: '\uD83D\uDCD6', color: '#2dd4bf', description: 'Beginner tips and progression walkthroughs.' },
  { slug: 'mechanics', label: 'Mechanics', icon: '\u2699', color: '#a1a1aa', description: 'Physics, combat, jetpack, and multiplayer.' },
]

const tips = [
  'Wood is your first priority after spawning. Punch trees to get started.',
  'Craft a workbench as soon as possible — it unlocks the first tier of recipes.',
  'Bosses are summoned with the F key near a valid altar. Make sure you are ready!',
  'The jetpack requires all 6 components from the 6 bosses. Check your inventory!',
  'Silver Coins drop from enemies and can be spent at the Sky Merchant in Cloud City.',
  'Accessories go in dedicated slots below your armor. You can equip up to 3.',
  'Lava deals rapid damage — do not fall in without fire-resistant gear.',
  'The Void Dimension is endgame content. Craft a Super Portal after beating all bosses.',
  'Hold Space while airborne with the jetpack to fly. Fuel recharges on the ground.',
  'Mining deeper yields rarer ores: Iron, Diamond, Titanium, and Carbon Fiber.',
]

const currentTip = tips[Math.floor(Math.random() * tips.length)]
</script>
