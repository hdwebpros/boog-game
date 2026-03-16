---
title: Combat
description: How combat works in Starfall - weapons, damage, defense, i-frames, and enchantments.
category: mechanic
tags: [mechanic, combat, weapons, damage, defense, enchantment]
---

# Combat Mechanics

Combat in Starfall involves attacking enemies with one of four weapon styles, managing HP and mana, using defense to reduce incoming damage, and taking advantage of enchantments and buffs. This page explains every combat system in detail.

## HP and Mana

### HP (Health Points)
- **Base HP**: Your starting maximum health.
- HP is reduced when you take damage from enemies, fall damage, or environmental hazards (lava).
- When HP reaches 0, you die and respawn at your spawn point with all items intact.
- HP regenerates slowly over time. Skills (Recovery: +1 HP/s) and potions (Regeneration: +2 HP/s) increase regen rate.
- Max HP can be increased by skills (Tough Skin: +25), accessories (Celestial Cape: +30), potions (Giant: +25), and artifacts (Chaos Heart: up to +200).

### Mana
- Mana is consumed when using **Magic** and **Summon** weapons.
- Mana regenerates passively over time.
- Max mana can be increased by skills (Mana Well: +30), accessories (Star Compass: +50, Celestial Cape: +30).
- Mana regen can be boosted by skills (Arcane Flow: +50%) and potions (Mana Surge: +50%).
- The Mana Shield skill redirects 25% of incoming damage to mana instead of HP.

## Weapon Styles

There are 4 distinct weapon styles, each with different attack mechanics.

### Melee

**How it works:** When you LMB with a melee weapon, your character swings in a 126-degree arc in front of them, hitting all enemies within approximately 4.5 tiles (72 pixels).

**Key properties:**
- Highest raw damage per hit (Wood Sword: 8, up to Chaos Edge: 150)
- No ammo or mana cost
- Attack speed varies by weapon (300-450ms cooldown)
- Can hit multiple enemies in one swing if they overlap the arc

**Melee weapons by tier:**

| Weapon | Damage | Attack Speed | Tier |
|--------|--------|-------------|------|
| Wood Sword | 8 | 400ms | 0 |
| Stone Sword | 14 | 380ms | 1 |
| Iron Sword | 22 | 350ms | 2 |
| Diamond Sword | 35 | 320ms | 3 |
| Titanium Sword | 50 | 300ms | 4 |
| Void Blade | 85 | 280ms | 5 |
| Abyssal Scythe | 110 | 450ms | 5 |
| Chaos Edge | 150 | 250ms | 6 |

### Ranged

**How it works:** LMB fires a projectile toward the cursor position. The projectile travels in a straight line and deals damage to the first enemy it hits.

**Key properties:**
- Safe damage from a distance
- Projectile speed varies by weapon
- No mana cost
- Lower base damage than melee (tradeoff for safety)

**Ranged weapons by tier:**

| Weapon | Damage | Attack Speed | Projectile Speed | Tier |
|--------|--------|-------------|-----------------|------|
| Wood Bow | 6 | 600ms | 400 px/s | 0 |
| Iron Bow | 18 | 500ms | 500 px/s | 2 |
| Laser Gun | 45 | 300ms | 700 px/s | 4 |
| Hellfire Bow | 70 | 250ms | 500 px/s | 5 |
| Dimensional Rifle | 120 | 200ms | 600 px/s | 6 |

### Magic

**How it works:** LMB fires a magic projectile toward the cursor. Each shot consumes mana. The projectile deals damage to the first enemy it hits.

**Key properties:**
- Costs mana per use (8-35 depending on weapon)
- Generally higher damage than ranged for the same tier
- Projectile speed varies
- Damage boosted by Magic Power Potion, Spell Power skill, and magic-specific enchantments

**Magic weapons by tier:**

| Weapon | Damage | Mana Cost | Attack Speed | Tier |
|--------|--------|-----------|-------------|------|
| Apprentice Staff | 12 | 8 | 500ms | 1 |
| Crystal Staff | 32 | 15 | 400ms | 3 |
| Void Staff | 95 | 25 | 320ms | 5 |
| Arcane Annihilator | 130 | 35 | 270ms | 6 |

### Summon

**How it works:** LMB spawns a minion that automatically seeks out and attacks nearby enemies. The minion persists for a duration and acts independently.

**Key properties:**
- Costs mana to summon
- Minion fights on its own -- you can mine, build, or use other weapons while it attacks
- Lower individual damage but adds sustained DPS
- Multiple summons can be active at once

**Summon weapons by tier:**

| Weapon | Minion Damage | Mana Cost | Summon Cooldown | Tier |
|--------|--------------|-----------|-----------------|------|
| Drone Totem | 10 | 20 | 1000ms | 2 |
| Swarm Beacon | 28 | 30 | 800ms | 4 |
| Soul Reaver | 60 | 40 | 800ms | 5 |

## Defense

**Defense** is a flat damage reduction value. Your total defense comes from:
- Armor pieces (each slot adds defense)
- Skills (Iron Body: +4)
- Potions (Ironskin: +10)
- Artifacts (Dimensional Anchor: up to +30 armor)

Incoming damage is reduced by your defense value. The formula ensures you always take at least 1 damage regardless of defense.

## I-Frames (Invincibility Frames)

After taking damage, your character becomes **invulnerable** for a brief period (i-frames). During this window:
- You flash/blink visually
- No additional damage can be dealt to you
- This prevents rapid multi-hits from overlapping enemies

I-frames last approximately 0.5-1 second. This is important in fights with multiple enemies -- getting hit by one gives you a window to escape without taking additional hits.

## Knockback

When you hit an enemy, they are knocked back away from you. When an enemy hits you, you are knocked back away from them.

- Knockback strength varies by attack
- Some enemies have **knockback resistance** (0 = full knockback, 1 = immune):
  - Rock Golem: 0.6 resistance
  - Nether Golem: 0.8 resistance
  - Dark Knight: 0.6 resistance
- The Dimensional Anchor artifact makes you knockback immune
- Knockback helps create distance for kiting strategies

## Damage Numbers

Every hit displays a floating damage number above the target. These numbers:
- Pop up at the point of impact
- Float upward briefly then fade
- Show the actual damage dealt (after defense calculations)
- Critical hits display larger/different colored numbers

## Critical Hits

Critical hits deal **2x damage**. They are not available by default -- you must unlock them:
- **Critical Eye** skill (Combat branch, tier 2): 15% crit chance
- **Void Eye** artifact (tier 2-3): +15-30% crit chance against revealed enemies

Critical hits apply to all weapon styles (melee, ranged, magic, summon).

## Enchantment Bonus Damage

Enchanted weapons deal additional elemental damage on top of their base damage:

| Enchantment | Bonus Effect |
|-------------|-------------|
| Inferno | Burn damage over time (fire) |
| Glacial | Slows enemy movement (ice) |
| Tempest | Bonus lightning damage |
| Abyssal | Bonus void damage |
| Verdant | Heals you on hit (life steal) |
| Eternal | All effects combined |

See the [Enchanting Guide](/wiki/guides/enchanting) for how to create and apply enchantments.

## Damage Multipliers

Multiple sources of damage increase can stack:

| Source | Bonus | Applies To |
|--------|-------|-----------|
| Sharp Edge (skill) | +20% | Melee |
| Power Strike (skill) | +30% | Melee |
| Quick Draw (skill) | +20% attack speed | All |
| Berserker (skill) | +50% below 30% HP | All |
| Spell Power (skill) | +30% | Magic |
| Rage Potion | +15% | Melee |
| Archery Potion | +20% | Ranged |
| Magic Power Potion | +20% | Magic |
| Wrath Potion | +25% | All |
| Chaos Mastery (Ascension) | +50% | All |
| Dimensional Anchor (artifact) | +25/40/60% | All |
| Mana Overload (super skill) | +100% (costs mana) | All |

## Damage Reduction

Incoming damage can be reduced by:

| Source | Reduction |
|--------|-----------|
| Armor defense | Flat subtraction |
| Endurance Potion | -15% damage taken |
| Forcefield Potion | Immune for 8 seconds |
| Void Armor (Ascension skill) | -30% damage taken |
| Mana Shield (skill) | 25% redirected to mana |

## Combat Tips

- **Switch weapons during fights.** Open with ranged/magic to get free hits while the enemy closes distance, then switch to melee for higher DPS.
- **Use terrain.** Build platforms and walls to control enemy movement. Many enemies cannot break blocks.
- **Stack buffs before boss fights.** Ironskin + Rage/Wrath + Regeneration is a strong combination.
- **I-frames are your friend.** After taking a hit, you have a brief window to reposition safely. Use it to heal or gain distance.
- **Summon weapons provide free DPS.** Summon a minion, then switch to your melee/ranged weapon. The minion keeps attacking independently.
- **Enchant your main weapon.** Even a basic Inferno or Glacial chant on your primary weapon significantly increases your effective damage.
