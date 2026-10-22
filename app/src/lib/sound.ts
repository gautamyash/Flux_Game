import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { getState } from '../store/store';

/* eslint-disable @typescript-eslint/no-require-imports */
const SRC = {
  step: require('../../assets/sounds/step.wav'),
  node: require('../../assets/sounds/node.wav'),
  bonus: require('../../assets/sounds/bonus.wav'),
  teleport: require('../../assets/sounds/teleport.wav'),
  undo: require('../../assets/sounds/undo.wav'),
  error: require('../../assets/sounds/error.wav'),
  hint: require('../../assets/sounds/hint.wav'),
  solve: require('../../assets/sounds/solve.wav'),
  fail: require('../../assets/sounds/fail.wav'),
  badge: require('../../assets/sounds/badge.wav'),
} as const;
const MUSIC = require('../../assets/sounds/music.wav');

export type SoundName = keyof typeof SRC;

const POOL = 2; // round-robin players so quick repeats can overlap
const pools: Partial<Record<SoundName, AudioPlayer[]>> = {};
const idx: Partial<Record<SoundName, number>> = {};
let music: AudioPlayer | null = null;
let ready = false;
let lastStep = 0;

function init() {
  if (ready) return;
  ready = true;
  try {
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
  } catch {
    /* ignore */
  }
}

function playerFor(name: SoundName): AudioPlayer | null {
  try {
    let p = pools[name];
    if (!p) {
      p = [];
      for (let i = 0; i < POOL; i++) {
        const pl = createAudioPlayer(SRC[name]);
        pl.volume = name === 'step' ? 0.35 : 0.8;
        p.push(pl);
      }
      pools[name] = p;
      idx[name] = 0;
    }
    const i = ((idx[name] ?? 0) + 1) % POOL;
    idx[name] = i;
    return p[i];
  } catch {
    return null;
  }
}

/** Play a sound effect if the player has sound enabled. Never throws. */
export function sfx(name: SoundName) {
  if (!getState().settings.sound) return;
  init();
  if (name === 'step') {
    const now = Date.now();
    if (now - lastStep < 45) return; // avoid machine-gun ticks while dragging fast
    lastStep = now;
  }
  const p = playerFor(name);
  if (!p) return;
  try {
    void p.seekTo(0);
    p.play();
  } catch {
    /* ignore */
  }
}

/** Start or stop the looping background music. */
export function setMusic(on: boolean) {
  try {
    if (!on) {
      music?.pause();
      return;
    }
    init();
    if (!music) {
      music = createAudioPlayer(MUSIC);
      music.loop = true;
      music.volume = 0.25;
    }
    music.play();
  } catch {
    /* ignore */
  }
}
