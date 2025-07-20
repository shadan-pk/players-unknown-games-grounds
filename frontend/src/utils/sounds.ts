class SoundManager {
    private sounds: { [key: string]: HTMLAudioElement } = {};
  
    constructor() {
      this.loadSounds();
    }
  
    private loadSounds() {
      this.sounds = {
        victory: new Audio('/sounds/victory.mp3'),
        defeat: new Audio('/sounds/defeat.mp3'),
        draw: new Audio('/sounds/draw.mp3'),
        achievement: new Audio('/sounds/achievement.mp3'),
        levelUp: new Audio('/sounds/level-up.mp3'),
      };
  
      // Preload and set volume
      Object.values(this.sounds).forEach(sound => {
        sound.preload = 'auto';
        sound.volume = 0.5;
      });
    }
  
    play(soundName: string) {
      const sound = this.sounds[soundName];
      if (sound) {
        sound.currentTime = 0;
        sound.play().catch(console.error);
      }
    }
  }
  
  export const soundManager = new SoundManager();
  export const playSound = (sound: string) => soundManager.play(sound);
  