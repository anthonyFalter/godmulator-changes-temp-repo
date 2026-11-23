/**
 * SoundEngine is currently disabled (silent no-op) while audio assets are paused.
 * All public methods remain intact so callers require zero changes when sound is re-enabled.
 */
class SoundEngine {
  public muted = true;

  public playTone(
    _freq: number,
    _duration: number,
    _type: OscillatorType = 'triangle',
    _volume = 0.08,
    _pitchSlide = 1.0,
  ): void {}

  public playClick(): void {}
  public playBuild(): void {}
  public playSculpt(): void {}
  public playSpawn(): void {}
  public playBlessing(): void {}
  public playCurse(): void {}
  public playMeteorIncoming(): void {}
  public playHeavyImpact(): void {}
  public playEarthquake(): void {}
  public playEpochAscend(): void {}
  public playMegaExplosion(): void {}
  public playFreeze(): void {}
  public playHeatWave(): void {}
  public playTornado(): void {}
  public playTsunami(): void {}
  public playGrab(): void {}
  public playThrow(): void {}
  public playHugeAsteroidApproach(): void {}
  public playVolcanoEruption(): void {}
  public playSuperTornado(): void {}
  public playVoidGoo(): void {}
  public playPortalSummon(): void {}
  public playAlienInvasion(): void {}
  public playOrbitalLaser(): void {}
  public playChronoWarp(): void {}
  public playPeaceAccord(): void {}
  public playGravityFlux(): void {}
  public playSkyRain(_kind?: string): void {}
}

export const soundEngine = new SoundEngine();
