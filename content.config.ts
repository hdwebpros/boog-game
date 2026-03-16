import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    wiki: defineCollection({
      type: 'page',
      source: 'wiki/**/*.md',
      schema: z.object({
        category: z.enum(['item', 'enemy', 'boss', 'biome', 'crafting', 'skill', 'mechanic', 'guide']).optional(),
        subcategory: z.string().optional(),
        gameId: z.number().optional(),
        tier: z.number().optional(),
        tags: z.array(z.string()).optional(),
        icon: z.string().optional(),
        stats: z.record(z.string(), z.any()).optional(),
        craftedAt: z.string().optional(),
        relatedItems: z.array(z.number()).optional(),
      })
    })
  }
})
