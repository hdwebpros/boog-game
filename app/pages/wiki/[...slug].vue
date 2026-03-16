<template>
  <div>
    <template v-if="page">
      <article class="prose prose-invert max-w-none">
        <h1 class="font-heading text-xl text-wiki-primary mb-6">{{ page.title }}</h1>

        <!-- Meta bar -->
        <div v-if="page.category || page.tier !== undefined" class="flex flex-wrap gap-2 mb-6 not-prose">
          <span
            v-if="page.category"
            class="neo bg-slate-700 px-3 py-1 text-xs uppercase tracking-wider"
          >
            {{ page.category }}
          </span>
          <span
            v-if="page.tier !== undefined"
            class="neo px-3 py-1 text-xs uppercase tracking-wider"
            :class="tierClass(page.tier)"
          >
            Tier {{ page.tier }}
          </span>
          <span
            v-for="tag in (page.tags || [])"
            :key="tag"
            class="bg-slate-700 px-2 py-1 text-xs text-gray-400 border border-slate-600"
          >
            {{ tag }}
          </span>
        </div>

        <!-- Stats table -->
        <div v-if="page.stats && Object.keys(page.stats).length" class="neo bg-slate-800 p-4 mb-6 not-prose">
          <h3 class="font-heading text-xs text-wiki-accent mb-3">Stats</h3>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <template v-for="(value, key) in page.stats" :key="key">
              <dt class="text-gray-400 capitalize">{{ String(key).replace(/_/g, ' ') }}</dt>
              <dd class="text-gray-100">{{ value }}</dd>
            </template>
          </dl>
        </div>

        <ContentRenderer :value="page" />
      </article>
    </template>

    <template v-else>
      <div class="text-center py-20">
        <h1 class="font-heading text-xl text-wiki-danger mb-4">Page Not Found</h1>
        <p class="text-gray-400 mb-6">This wiki page does not exist yet.</p>
        <NuxtLink to="/wiki" class="neo bg-slate-700 px-6 py-3 text-sm hover:bg-slate-600 transition-colors inline-block">
          Back to Wiki
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'wiki',
})

const route = useRoute()
const wikiPath = computed(() => '/wiki/' + (Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug))

const { data: page } = await useAsyncData(
  `wiki-${wikiPath.value}`,
  () => queryCollection('wiki').path(wikiPath.value).first()
)

// Provide page data to MDC components (infoboxes auto-read frontmatter)
provide('wiki-page', page)

useHead({
  title: computed(() => page.value ? `${page.value.title} - Starfall Wiki` : 'Page Not Found - Starfall Wiki'),
  meta: [
    { name: 'description', content: computed(() => page.value?.description || 'Starfall Wiki page') },
  ],
})

function tierClass(tier: number): string {
  const tierColors: Record<number, string> = {
    0: 'bg-gray-600 text-gray-200',
    1: 'bg-green-900 text-green-300',
    2: 'bg-blue-900 text-blue-300',
    3: 'bg-purple-900 text-purple-300',
    4: 'bg-orange-900 text-orange-300',
    5: 'bg-red-900 text-red-300',
    6: 'bg-yellow-900 text-yellow-300',
  }
  return tierColors[tier] || tierColors[0]
}
</script>
