<script setup lang="ts">
const tips = [
  'Press C to open the crafting menu. You need to be near a crafting station for advanced recipes.',
  'Hold Space while airborne with the jetpack equipped to fly. Watch your fuel gauge!',
  'Press F near a boss altar to summon the boss. Make sure you are prepared!',
  'You can sell items to the Sky Merchant in Cloud City for Silver Coins.',
  'Mining speed depends on your pickaxe tier. Upgrade as soon as you can.',
  'WASD or Arrow Keys to move. Space or W to jump. Shift to dash!',
  'Right-click to place blocks. Left-click to mine or attack.',
  'Press Q to drop the currently selected item from your hotbar.',
  'Press I to use/consume the selected item (potions, food, etc.).',
  'Accessories go in the 3 slots below your armor in the inventory panel.',
  'Each boss drops a unique jetpack component. Collect all 6 to assemble the jetpack at a Fusion Station.',
  'The Cloud City floats high above the spawn area. Build up or use the jetpack to reach it.',
  'Different biomes spawn different enemies. Explore carefully!',
  'Obsidian is found near the Core layer. You need a Diamond pickaxe or better to mine it.',
  'Press Shift to dash! It gives brief invulnerability — great for dodging boss attacks.',
  'You need at least a Wood Pickaxe to mine stone and ores. Bare hands only work on dirt, grass, and wood.',
  'After beating the game, craft a Super Portal to access the Void Dimension.',
  'The Void Lord is the true final boss. You must visit the Void Dimension first to unlock the summon.',
  'Artifacts from the Sky Merchant can be upgraded 3 times for powerful effects.',
  'Lava deals rapid damage. Avoid it unless you have the Gravity Belt accessory.',
  'Press ESC to open the pause menu where you can save your game.',
  'Iron ore appears in the Underground layer. Look for it in cave walls.',
]

const tip = ref('')

onMounted(() => {
  tip.value = tips[Math.floor(Math.random() * tips.length)]!
})
</script>

<template>
  <div class="my-4 border-2 border-black shadow-[4px_4px_0_black] bg-slate-800 text-white max-w-lg">
    <!-- Header -->
    <div class="bg-yellow-500 border-b-2 border-black px-4 py-2">
      <span class="font-bold text-black">Tip of the Day</span>
    </div>

    <!-- Tip content -->
    <div class="px-4 py-3 text-sm leading-relaxed border-l-4 border-yellow-500">
      <p class="m-0 text-slate-200">{{ tip }}</p>
    </div>
  </div>
</template>
