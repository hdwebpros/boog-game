<script setup lang="ts">
const props = defineProps<{
  id?: string | number
  name: string
  icon?: string
}>()

const href = computed(() => {
  const slug = props.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return `/wiki/items/${slug}`
})

const imgSrc = computed(() => {
  if (props.icon) return props.icon
  if (props.id) return `/sprites/item_${props.id}.png`
  return ''
})
</script>

<template>
  <NuxtLink :to="href" class="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 no-underline hover:underline font-medium">
    <NuxtImg
      v-if="imgSrc"
      :src="imgSrc"
      :alt="name"
      width="16"
      height="16"
      class="w-4 h-4 [image-rendering:pixelated] inline-block"
    />
    <span>{{ name }}</span>
  </NuxtLink>
</template>
