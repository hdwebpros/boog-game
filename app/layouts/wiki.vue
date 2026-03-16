<template>
  <div class="h-screen bg-slate-900 text-gray-100 flex flex-col overflow-hidden">
    <!-- Mobile header -->
    <header class="md:hidden flex items-center justify-between px-4 py-3 bg-slate-800 border-b-2 border-black">
      <NuxtLink to="/wiki" class="font-heading text-sm text-wiki-primary">Starfall Wiki</NuxtLink>
      <button
        class="neo bg-slate-700 px-3 py-2 text-sm"
        @click="sidebarOpen = !sidebarOpen"
        aria-label="Toggle navigation"
      >
        <span v-if="!sidebarOpen">&#9776;</span>
        <span v-else>&#10005;</span>
      </button>
    </header>

    <div class="flex">
      <!-- Sidebar -->
      <aside
        :class="[
          'w-64 shrink-0 bg-slate-800 border-r-2 border-black min-h-screen',
          'fixed md:sticky top-0 left-0 z-40 md:z-auto',
          'transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        ]"
      >
        <div class="p-4 border-b-2 border-black">
          <NuxtLink to="/wiki" class="font-heading text-sm text-wiki-primary hover:text-wiki-accent block">
            Starfall Wiki
          </NuxtLink>
        </div>

        <nav class="p-2 overflow-y-auto max-h-[calc(100vh-60px)]">
          <div v-for="cat in categories" :key="cat.slug" class="mb-1">
            <button
              class="w-full flex items-center justify-between px-3 py-2 text-sm font-bold hover:bg-slate-700 transition-colors text-left"
              :style="{ color: cat.color }"
              @click="toggleCategory(cat.slug)"
            >
              <span>{{ cat.icon }} {{ cat.label }}</span>
              <span class="text-xs">{{ expandedCategories.includes(cat.slug) ? '&#9660;' : '&#9654;' }}</span>
            </button>
            <div v-if="expandedCategories.includes(cat.slug)" class="ml-4 mb-2">
              <NuxtLink
                :to="`/wiki/${cat.slug}`"
                class="block px-3 py-1 text-xs text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
                @click="sidebarOpen = false"
              >
                All {{ cat.label }}
              </NuxtLink>
            </div>
          </div>
        </nav>

        <div class="p-4 border-t-2 border-black mt-auto">
          <NuxtLink
            to="/"
            class="block text-xs text-gray-500 hover:text-gray-300 transition-colors"
            @click="sidebarOpen = false"
          >
            &larr; Back to Game
          </NuxtLink>
        </div>
      </aside>

      <!-- Backdrop for mobile -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 bg-black/50 z-30 md:hidden"
        @click="sidebarOpen = false"
      />

      <!-- Main content -->
      <main class="flex-1 min-w-0">
        <!-- Breadcrumb -->
        <div class="px-6 py-3 bg-slate-800/50 border-b-2 border-black">
          <nav class="flex items-center gap-2 text-xs text-gray-400">
            <NuxtLink to="/wiki" class="hover:text-wiki-primary transition-colors">Wiki</NuxtLink>
            <template v-for="(crumb, i) in breadcrumbs" :key="i">
              <span>/</span>
              <NuxtLink
                v-if="crumb.path"
                :to="crumb.path"
                class="hover:text-wiki-primary transition-colors capitalize"
              >
                {{ crumb.label }}
              </NuxtLink>
              <span v-else class="text-gray-200 capitalize">{{ crumb.label }}</span>
            </template>
          </nav>
        </div>

        <div class="p-6">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const sidebarOpen = ref(false)
const expandedCategories = ref<string[]>([])

const categories = [
  { slug: 'items', label: 'Items', icon: '!', color: '#facc15' },
  { slug: 'enemies', label: 'Enemies', icon: '!', color: '#f87171' },
  { slug: 'bosses', label: 'Bosses', icon: '!', color: '#c084fc' },
  { slug: 'biomes', label: 'Biomes', icon: '!', color: '#34d399' },
  { slug: 'crafting', label: 'Crafting', icon: '!', color: '#60a5fa' },
  { slug: 'skills', label: 'Skills', icon: '!', color: '#fb923c' },
  { slug: 'guides', label: 'Guides', icon: '!', color: '#2dd4bf' },
  { slug: 'mechanics', label: 'Mechanics', icon: '!', color: '#a1a1aa' },
]

function toggleCategory(slug: string) {
  const idx = expandedCategories.value.indexOf(slug)
  if (idx >= 0) {
    expandedCategories.value.splice(idx, 1)
  } else {
    expandedCategories.value.push(slug)
  }
}

const breadcrumbs = computed(() => {
  const path = route.path.replace(/^\/wiki\/?/, '')
  if (!path) return []
  const parts = path.split('/').filter(Boolean)
  return parts.map((part, i) => ({
    label: part.replace(/-/g, ' '),
    path: i < parts.length - 1 ? '/wiki/' + parts.slice(0, i + 1).join('/') : null,
  }))
})

watch(() => route.path, () => {
  sidebarOpen.value = false
})
</script>
