export enum Difficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
  HARDCORE = 'hardcore',
}

export interface DifficultyMultipliers {
  enemyHp: number
  enemyDamage: number
  enemySpeed: number
  bossHp: number
  bossDamage: number
  spawnCapMult: number
  spawnIntervalMult: number
  playerMaxHp: number
  playerMaxMana: number
  playerIFramesMult: number
  playerRespawnMult: number
  lootChanceMult: number
  xpMult: number
  defenseEfficiency: number
  permadeath: boolean
}

const MULTIPLIER_TABLE: Record<Difficulty, DifficultyMultipliers> = {
  [Difficulty.EASY]: {
    enemyHp: 0.7, enemyDamage: 0.6, enemySpeed: 0.9,
    bossHp: 0.7, bossDamage: 0.6,
    spawnCapMult: 0.7, spawnIntervalMult: 1.4,
    playerMaxHp: 1.5, playerMaxMana: 1.2,
    playerIFramesMult: 1.4, playerRespawnMult: 1.0,
    lootChanceMult: 1.3, xpMult: 1.5, defenseEfficiency: 1.2,
    permadeath: false,
  },
  [Difficulty.NORMAL]: {
    enemyHp: 1.0, enemyDamage: 1.0, enemySpeed: 1.0,
    bossHp: 1.0, bossDamage: 1.0,
    spawnCapMult: 1.0, spawnIntervalMult: 1.0,
    playerMaxHp: 1.0, playerMaxMana: 1.0,
    playerIFramesMult: 1.0, playerRespawnMult: 1.0,
    lootChanceMult: 1.0, xpMult: 1.0, defenseEfficiency: 1.0,
    permadeath: false,
  },
  [Difficulty.HARD]: {
    enemyHp: 1.5, enemyDamage: 1.4, enemySpeed: 1.15,
    bossHp: 1.5, bossDamage: 1.4,
    spawnCapMult: 1.3, spawnIntervalMult: 0.75,
    playerMaxHp: 0.8, playerMaxMana: 1.0,
    playerIFramesMult: 0.7, playerRespawnMult: 1.5,
    lootChanceMult: 0.8, xpMult: 0.8, defenseEfficiency: 0.8,
    permadeath: false,
  },
  [Difficulty.HARDCORE]: {
    enemyHp: 1.5, enemyDamage: 1.6, enemySpeed: 1.2,
    bossHp: 1.8, bossDamage: 1.6,
    spawnCapMult: 1.5, spawnIntervalMult: 0.6,
    playerMaxHp: 0.7, playerMaxMana: 1.0,
    playerIFramesMult: 0.5, playerRespawnMult: 1.0,
    lootChanceMult: 0.7, xpMult: 0.7, defenseEfficiency: 0.7,
    permadeath: true,
  },
}

const LABELS: Record<Difficulty, string> = {
  [Difficulty.EASY]: 'Easy',
  [Difficulty.NORMAL]: 'Normal',
  [Difficulty.HARD]: 'Hard',
  [Difficulty.HARDCORE]: 'Hardcore',
}

const COLORS: Record<Difficulty, string> = {
  [Difficulty.EASY]: '#44ff44',
  [Difficulty.NORMAL]: '#ffffff',
  [Difficulty.HARD]: '#ff8800',
  [Difficulty.HARDCORE]: '#ff2222',
}

export class DifficultyManager {
  private static current: Difficulty = Difficulty.NORMAL

  static set(d: string) {
    if (Object.values(Difficulty).includes(d as Difficulty)) {
      this.current = d as Difficulty
    } else {
      this.current = Difficulty.NORMAL
    }
  }

  static get(): DifficultyMultipliers {
    return MULTIPLIER_TABLE[this.current]
  }

  static getDifficulty(): Difficulty {
    return this.current
  }

  static isPermadeath(): boolean {
    return MULTIPLIER_TABLE[this.current].permadeath
  }

  static getLabel(): string {
    return LABELS[this.current]
  }

  static getColor(): string {
    return COLORS[this.current]
  }
}
