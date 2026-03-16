// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  alias: {
    '@game': new URL('./game', import.meta.url).pathname,
  },

  nitro: {
    experimental: {
      websocket: true,
    },
  },

  modules: [],
})