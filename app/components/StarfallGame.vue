<template>
  <div ref="gameContainer" class="starfall-container" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Phaser from 'phaser'
import { createGameConfig } from '@game/config'

const gameContainer = ref<HTMLElement | null>(null)
let game: Phaser.Game | null = null

onMounted(() => {
  if (gameContainer.value) {
    const config = createGameConfig(gameContainer.value)
    game = new Phaser.Game(config)
  }
})

onBeforeUnmount(() => {
  if (game) {
    game.destroy(true)
    game = null
  }
})
</script>

<style scoped>
.starfall-container {
  width: 100vw;
  height: 100vh;
}

.starfall-container canvas {
  display: block;
}
</style>
