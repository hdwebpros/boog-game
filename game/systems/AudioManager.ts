import { sfxr } from 'jsfxr'
import { SoundId, SOUND_DEFS } from '../data/sounds'
import type { SoundDef } from '../data/sounds'

// Cooldowns to prevent overlapping identical sounds (ms)
const DEFAULT_COOLDOWN = 50
const SOUND_COOLDOWNS: Partial<Record<SoundId, number>> = {
  [SoundId.MINE_HIT]: 200,
  [SoundId.JETPACK_THRUST]: 150,
  [SoundId.SLOT_CHANGE]: 30,
  [SoundId.ENEMY_HIT]: 100,
}

export enum MusicTrack {
  TITLE = 'title',
  SURFACE = 'surface',
  UNDERGROUND = 'underground',
  BOSS = 'boss',
}

const MUSIC_PATHS: Record<MusicTrack, string> = {
  [MusicTrack.TITLE]: '/music/title-screen.mp3',
  [MusicTrack.SURFACE]: '/music/surface.mp3',
  [MusicTrack.UNDERGROUND]: '/music/underground.mp3',
  [MusicTrack.BOSS]: '/music/boss.mp3',
}

const MUSIC_VOLUME = 0.35
const CROSSFADE_MS = 1500

/**
 * Singleton audio manager using jsfxr for procedural 8-bit sound effects.
 * Pre-generates all sounds as WAV dataURIs at boot time, then plays them
 * via HTMLAudioElement for reliable cloning and overlap support.
 * Also manages background music with crossfading between tracks.
 */
export class AudioManager {
  private static instance: AudioManager | null = null

  private cache = new Map<SoundId, string>() // dataURI per sound
  private lastPlayed = new Map<SoundId, number>()
  private muted = false
  private volume = 1.0

  // Music state
  private musicElements = new Map<MusicTrack, HTMLAudioElement>()
  private currentMusic: MusicTrack | null = null
  private musicVolume = MUSIC_VOLUME
  private fadingOut: HTMLAudioElement | null = null
  private fadeTimer: number | null = null

  static init(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager()
      AudioManager.instance.generateAll()
      AudioManager.instance.preloadMusic()
    }
    return AudioManager.instance
  }

  static get(): AudioManager | null {
    return AudioManager.instance
  }

  private generateAll() {
    for (const [id, def] of Object.entries(SOUND_DEFS)) {
      const soundId = id as SoundId
      try {
        const dataURI = this.generateDataURI(def)
        if (dataURI) {
          this.cache.set(soundId, dataURI)
        }
      } catch {
        // Silently skip failed sound generation
      }
    }
  }

  private generateDataURI(def: SoundDef): string | null {
    let params: Record<string, unknown>
    if ('preset' in def) {
      params = sfxr.generate(def.preset)
    } else if ('params' in def) {
      params = { ...def.params }
    } else {
      return null
    }
    if (def.volume !== undefined) {
      params.sound_vol = def.volume
    }
    const wave = sfxr.toWave(params)
    return wave.dataURI
  }

  private preloadMusic() {
    for (const [track, path] of Object.entries(MUSIC_PATHS)) {
      const audio = new Audio(path)
      audio.loop = true
      audio.volume = 0
      audio.preload = 'auto'
      this.musicElements.set(track as MusicTrack, audio)
    }
  }

  play(id: SoundId) {
    if (this.muted) return

    const now = performance.now()
    const cooldown = SOUND_COOLDOWNS[id] ?? DEFAULT_COOLDOWN
    const last = this.lastPlayed.get(id) ?? 0
    if (now - last < cooldown) return

    const dataURI = this.cache.get(id)
    if (!dataURI) return

    this.lastPlayed.set(id, now)

    const audio = new Audio(dataURI)
    audio.volume = this.volume
    audio.play().catch(() => {
      // Autoplay blocked — ignore silently
    })
  }

  // ── Music ────────────────────────────────────────────────

  playMusic(track: MusicTrack) {
    if (track === this.currentMusic) return

    const next = this.musicElements.get(track)
    if (!next) return

    // Cancel any in-progress fade
    if (this.fadeTimer !== null) {
      cancelAnimationFrame(this.fadeTimer)
      this.fadeTimer = null
    }

    // Fade out current track
    const prev = this.currentMusic ? this.musicElements.get(this.currentMusic) : null
    if (prev) {
      this.fadeOut(prev)
    }
    if (this.fadingOut && this.fadingOut !== prev) {
      this.fadingOut.pause()
      this.fadingOut.currentTime = 0
      this.fadingOut.volume = 0
    }

    // Fade in new track
    this.currentMusic = track
    const targetVol = this.muted ? 0 : this.musicVolume
    next.volume = 0
    next.play().catch(() => {})
    this.fadeIn(next, targetVol)
  }

  stopMusic() {
    if (this.fadeTimer !== null) {
      cancelAnimationFrame(this.fadeTimer)
      this.fadeTimer = null
    }

    const current = this.currentMusic ? this.musicElements.get(this.currentMusic) : null
    if (current) {
      this.fadeOut(current)
    }
    this.currentMusic = null
  }

  private fadeOut(audio: HTMLAudioElement) {
    this.fadingOut = audio
    const startVol = audio.volume
    const startTime = performance.now()

    const tick = () => {
      const elapsed = performance.now() - startTime
      const t = Math.min(1, elapsed / CROSSFADE_MS)
      audio.volume = startVol * (1 - t)
      if (t < 1) {
        this.fadeTimer = requestAnimationFrame(tick)
      } else {
        audio.pause()
        audio.currentTime = 0
        audio.volume = 0
        this.fadingOut = null
        this.fadeTimer = null
      }
    }
    this.fadeTimer = requestAnimationFrame(tick)
  }

  private fadeIn(audio: HTMLAudioElement, targetVol: number) {
    const startTime = performance.now()

    const tick = () => {
      const elapsed = performance.now() - startTime
      const t = Math.min(1, elapsed / CROSSFADE_MS)
      audio.volume = targetVol * t
      if (t < 1) {
        this.fadeTimer = requestAnimationFrame(tick)
      } else {
        this.fadeTimer = null
      }
    }
    this.fadeTimer = requestAnimationFrame(tick)
  }

  setMuted(muted: boolean) {
    this.muted = muted
    // Update current music volume
    if (this.currentMusic) {
      const el = this.musicElements.get(this.currentMusic)
      if (el) el.volume = muted ? 0 : this.musicVolume
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    this.setMuted(this.muted)
    return this.muted
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol))
  }

  isMuted(): boolean {
    return this.muted
  }
}
