// The audio's public face. main.ts talks to this and nothing else.

export { ambienceFor, sameAir } from './ambience';
export { cuesFor, exposed } from './cues';
export { hushAmbience, isMuted, play, playAll, setAmbience, toggleMute, wake } from './engine';
