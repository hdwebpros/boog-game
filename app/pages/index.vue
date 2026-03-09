<template>
  <div class="game-page">
    <ClientOnly>
      <StarfallGame />
    </ClientOnly>
  </div>
</template>

<style>
body {
  margin: 0;
  background: #0a0a1a;
  overflow: hidden;
}

.game-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
</style>
