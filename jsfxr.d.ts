declare module 'jsfxr' {
  interface SfxrApi {
    generate(preset: string): Record<string, unknown>
    toAudio(params: Record<string, unknown>): HTMLAudioElement
    toWave(params: Record<string, unknown>): { dataURI: string }
    toBuffer(params: Record<string, unknown>): Float32Array
    play(params: Record<string, unknown>): void
  }

  export const sfxr: SfxrApi
  export const jsfxr: { sfxr: SfxrApi }
  export default jsfxr
}
