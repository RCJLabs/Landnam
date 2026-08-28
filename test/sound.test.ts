// 5.1: what the game sounds like.
//
// The roadmap's line is "WebAudio synth: wind, drums, horn, UI ticks. Mute
// toggle." — no bar attached, so this file sets four:
//
//   1. Zero assets, still. Nothing in the sound layer names a file or a URL,
//      and the noise it needs is generated. Hard constraint 1 is the one that
//      would be quietest to break and loudest to regret.
//   2. Silence is the default and the mute is total. Nothing plays before the
//      player has touched the screen, nothing throws when there is no
//      AudioContext at all, and muted means zero nodes — not zero volume.
//   3. The sound tracks the game, not the input. Every cue is derived from a
//      diff of two states, so a blow that lands and a blow that misses sound
//      different because the STATE differs, including on the foes' turns when
//      the player did nothing at all.
//   4. The wind is read off the world. Winter on an open shore is harsher
//      than summer under trees, and a hall is quieter than either.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { newGame } from '../src/state/create';
import { apply, type Action } from '../src/sim/actions';
import { cuesFor } from '../src/audio/cues';
import { ambienceFor, sameAir } from '../src/audio/ambience';
import { SOUNDS, soundDef, soundLength, AMBIENCE_INDOORS, type CueId } from '../src/data/sounds';
import { SEASON_LENGTH } from '../src/sim/calendar';
import { startBattle } from '../src/sim/battleTurn';
import { ROUTE_COUNTRY, ROUTE_STOPS, stopAt } from '../src/sim/route';
import { countryHere } from '../src/sim/coast';
import type { GameState, Terrain } from '../src/state/types';

function fresh(seed = 'sound'): GameState {
  return structuredClone(newGame(seed));
}

/**
 * Put the band on this ground, whichever way the game addresses ground.
 *
 * On a line rewriting the tile under `party.at` does nothing — `countryHere`
 * reads the STRETCH — so every ambience bar below was measuring the landing's
 * shore however many terrains it named, and "keeps every profile inside what
 * the engine can play" walked eight grounds while standing on one.
 */
function standingOn(state: GameState, terrain: Terrain): GameState {
  const next = structuredClone(state);
  // A coast does not carry every country. Since `ROUTE_COUNTRY` stopped
  // being a uniform sixth each — valley is 8% of it now, so a 25-stretch
  // coast misses one about an eighth of the time — asking a particular
  // seed for a valley is a coin toss, and the bar would fail on the
  // country rather than on the sound. So walk seeds until one has it, and
  // carry the day over, which is the only thing the ambience reads besides
  // the ground.
  for (let s = -1; s < 200; s += 1) {
    const on = s < 0 ? next : structuredClone(newGame(`${state.seed}-on-${terrain}-${s}`));
    const stop = [...Array(ROUTE_STOPS).keys()]
      .find((i) => stopAt(on.seed, i).country === terrain);
    if (stop === undefined) continue;
    on.party.stop = stop;
    on.day = state.day;
    expect(countryHere(on), `stood on ${terrain} and the sim disagrees`).toBe(terrain);
    return on;
  }
  throw new Error(`no coast in two hundred carries ${terrain}`);
}

// --- 1. Zero assets ---

describe('the sound layer ships no assets', () => {
  it('describes every sound as a recipe rather than a reference', () => {
    for (const def of SOUNDS) {
      const written = JSON.stringify(def);
      expect(written).not.toMatch(/https?:\/\//);
      expect(written).not.toMatch(/\.(mp3|ogg|wav|m4a|webm|aac|flac)\b/i);
      expect(def.layers.length).toBeGreaterThan(0);
    }
  });

  it('gives every cue id exactly one definition', () => {
    const ids = SOUNDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(soundDef(id)).toBeDefined();
  });

  it('keeps every layer physically playable and bounded', () => {
    for (const def of SOUNDS) {
      for (const layer of def.layers) {
        expect(layer.gain).toBeGreaterThan(0);
        // Nothing may reach the master at full scale; the mix has 20+ voices.
        expect(layer.gain).toBeLessThanOrEqual(0.2);
        expect(layer.attack).toBeGreaterThan(0);
        expect(layer.decay).toBeGreaterThan(0);
        expect(layer.at ?? 0).toBeGreaterThanOrEqual(0);
        const freq = layer.kind === 'tone' ? layer.freq : layer.freq;
        expect(freq).toBeGreaterThan(20);
        expect(freq).toBeLessThan(20000);
      }
      // A cue that outlasts a turn would still be ringing over the next one.
      expect(soundLength(def)).toBeLessThanOrEqual(3.5);
    }
  });

  it('documents every sound, because a recipe nobody can picture is unmaintainable', () => {
    for (const def of SOUNDS) expect(def.note.length).toBeGreaterThan(10);
  });
});

// --- 2. Silence by default, and a mute that means it ---

describe('the engine is inert until it is welcome', () => {
  let made = 0;

  /**
   * Vitest runs these in bare Node — no window, no localStorage, no WebAudio.
   * That is not a limitation to work around, it IS the hostile environment the
   * engine promises to survive, so everything it needs is handed to it
   * explicitly here and taken away again afterwards.
   */
  function fakeStorage(initial: Record<string, string> = {}, deny = false) {
    const held = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => held.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (deny) throw new Error('storage denied');
        held.set(k, v);
      },
      removeItem: (k: string) => void held.delete(k),
      clear: () => held.clear(),
      key: () => null,
      length: 0,
    };
  }

  function param() {
    return {
      value: 0,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
      setTargetAtTime() {},
      cancelScheduledValues() {},
    };
  }

  class SpyContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 8000;
    destination = {};
    constructor() {
      made += 1;
    }
    createGain() {
      return { gain: param(), connect() {} };
    }
    createOscillator() {
      return { type: '', frequency: param(), detune: {}, connect() {}, start() {}, stop() {} };
    }
    createBufferSource() {
      return { buffer: null, loop: false, connect() {}, start() {}, stop() {} };
    }
    createBiquadFilter() {
      return { type: '', frequency: param(), Q: {}, connect() {} };
    }
    createBuffer(_channels: number, frames: number) {
      const data = new Float32Array(frames);
      return { getChannelData: () => data };
    }
    resume() {
      return Promise.resolve();
    }
  }

  function withAudio(): void {
    (globalThis as Record<string, unknown>).window = { AudioContext: SpyContext };
    (globalThis as Record<string, unknown>).AudioContext = SpyContext;
  }

  beforeEach(() => {
    vi.resetModules();
    made = 0;
    (globalThis as Record<string, unknown>).localStorage = fakeStorage();
  });

  afterEach(() => {
    for (const name of ['window', 'AudioContext', 'localStorage']) {
      delete (globalThis as Record<string, unknown>)[name];
    }
  });

  it('makes no AudioContext until something wakes it', async () => {
    withAudio();
    const engine = await import('../src/audio/engine');
    engine.play('horn');
    engine.play('strike');
    engine.setAmbience({ cutoff: 500, gain: 0.05, gustRate: 0.2, gustDepth: 0.3 });
    expect(made).toBe(0);

    // And then does, exactly once, when the player finally touches the screen.
    engine.wake();
    engine.wake();
    expect(made).toBe(1);
  });

  it('survives a browser with no WebAudio at all', async () => {
    (globalThis as Record<string, unknown>).window = {};
    const engine = await import('../src/audio/engine');
    expect(() => {
      engine.wake();
      engine.play('horn');
      engine.setAmbience(AMBIENCE_INDOORS);
      engine.hushAmbience();
    }).not.toThrow();
    expect(made).toBe(0);
  });

  it('muted means no nodes at all, not merely no volume', async () => {
    // The pre-store form. Reading it and rewriting it is the migration.
    (globalThis as Record<string, unknown>).localStorage = fakeStorage({ landnam_mute: '1' });
    withAudio();
    const engine = await import('../src/audio/engine');
    expect(engine.isMuted()).toBe(true);

    engine.wake();
    let built = 0;
    const spy = vi
      .spyOn(SpyContext.prototype, 'createOscillator')
      .mockImplementation(function (this: SpyContext) {
        built += 1;
        return { type: '', frequency: param(), detune: {}, connect() {}, start() {}, stop() {} };
      });
    engine.playAll(['horn', 'jarl', 'won', 'knell']);
    expect(built).toBe(0);

    // Unmuted, the same cues build voices — so the zero above means something.
    engine.toggleMute();
    engine.play('horn');
    expect(built).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it('remembers the mute across a reload', async () => {
    const held = fakeStorage({ landnam_mute: 'true' });
    (globalThis as Record<string, unknown>).localStorage = held;
    const engine = await import('../src/audio/engine');
    expect(engine.isMuted()).toBe(true);
    expect(engine.toggleMute()).toBe(false);
    expect(held.getItem('landnam_mute')).toBe('false');

    // A fresh load reads it back rather than defaulting.
    vi.resetModules();
    const reloaded = await import('../src/audio/engine');
    expect(reloaded.isMuted()).toBe(false);
  });

  it('does not fall over when storage is refused', async () => {
    (globalThis as Record<string, unknown>).localStorage = fakeStorage({}, true);
    const engine = await import('../src/audio/engine');
    expect(() => engine.toggleMute()).not.toThrow();
    expect(engine.isMuted()).toBe(true);
  });
});

// --- 3. The sound tracks the state ---

describe('cues are read off what changed', () => {
  it('says nothing at all when a dispatch changed nothing', () => {
    const state = fresh();
    expect(cuesFor(state, state, { type: 'CAMP' })).toEqual([]);
  });

  it('walks on land and rows on water', () => {
    // A line has no water to stand on, so the distinction is HOW FAR the
    // band got in a day: `daysToWalk` prices one stop at the length of its
    // leg and anything further at a single day at the oars. One stretch is
    // a walk; a jump is a row.
    //
    // This bar was green and measuring nothing before the fixture was
    // fixed — `standingOn` rewrote a tile the sim does not read, so 'land'
    // and 'ocean' were the same shore, and `WALK` made no sound at all
    // because `cuesFor` only knew about `MOVE`.
    const from = fresh();
    from.party.stop = 4;
    const walked = structuredClone(from);
    walked.party.stop = 5;
    const rowed = structuredClone(from);
    rowed.party.stop = 7;
    expect(cuesFor(from, walked, { type: 'WALK', to: 5 })).toContain('step');
    expect(cuesFor(from, rowed, { type: 'WALK', to: 7 })).toContain('oar');
    expect(cuesFor(from, rowed, { type: 'WALK', to: 7 })).not.toContain('step');
  });

  it('blows the horn the moment a field exists that did not', () => {
    const before = fresh('horn-seed');
    const after = structuredClone(before);
    startBattle(after, 'meadow', 0);
    expect(cuesFor(before, after, { type: 'CAMP' })).toContain('horn');
  });

  it('distinguishes a blow that lands from one that misses, by state alone', () => {
    const before = fresh('blows');
    startBattle(before, 'meadow', 0);
    const swing: Action = { type: 'B_STRIKE', targetId: before.battle!.foes[0]!.id };

    const missed = structuredClone(before);
    missed.battle!.log.push('Someone swung and missed.');
    expect(cuesFor(before, missed, swing)).toContain('miss');
    expect(cuesFor(before, missed, swing)).not.toContain('strike');

    const landed = structuredClone(before);
    landed.battle!.foes[0]!.health -= 3;
    landed.battle!.log.push('Someone struck someone (3).');
    expect(cuesFor(before, landed, swing)).toContain('strike');
    expect(cuesFor(before, landed, swing)).not.toContain('miss');
  });

  it('is not fooled by the word "shield" in a miss', () => {
    const before = fresh('shieldy');
    startBattle(before, 'meadow', 0);
    const after = structuredClone(before);
    // This is the real wording of a MISS against a defending fighter.
    after.battle!.log.push("Ari beat on Bjorn's shield to no effect.");
    const cues = cuesFor(before, after, { type: 'B_STRIKE', targetId: 'x' });
    expect(cues).toContain('miss');
    expect(cues).not.toContain('wall');
  });

  it('hears a blow on the foes’ turn, when the player did nothing', () => {
    const before = fresh('theirturn');
    startBattle(before, 'meadow', 0);
    const after = structuredClone(before);
    after.party.people[0]!.health -= 4;
    const cues = cuesFor(before, after, { type: 'B_END_TURN' });
    expect(cues).toContain('strike');
    // No swing of ours, so no whiff of ours either.
    expect(cues).not.toContain('miss');
  });

  it('tolls once for a death, however many were lost', () => {
    const before = fresh('bell');
    const after = structuredClone(before);
    after.party.people[0]!.alive = false;
    after.party.people[1]!.alive = false;
    const cues = cuesFor(before, after, { type: 'B_END_TURN' });
    expect(cues.filter((c) => c === 'knell')).toHaveLength(1);
  });

  it('turns the season over exactly once, on the day it turns', () => {
    const before = fresh();
    const after = structuredClone(before);
    after.day = SEASON_LENGTH + 1;
    expect(cuesFor(before, after, { type: 'CAMP' })).toContain('thaw');

    const sameSeason = structuredClone(before);
    sameSeason.day = before.day + 1;
    expect(cuesFor(before, sameSeason, { type: 'CAMP' })).not.toContain('thaw');
  });

  it('separates a jarldom from every other ending', () => {
    const before = fresh();
    const jarl = structuredClone(before);
    jarl.end = { cause: 'jarl', title: 'x', lines: [] };
    const starved = structuredClone(before);
    starved.end = { cause: 'starved', title: 'x', lines: [] };
    expect(cuesFor(before, jarl, { type: 'CAMP' })).toContain('jarl');
    expect(cuesFor(before, starved, { type: 'CAMP' })).toContain('ending');
    expect(cuesFor(before, starved, { type: 'CAMP' })).not.toContain('jarl');
  });

  it('only ever asks for sounds that exist', () => {
    // A real run, dispatched for real, so this covers whatever the game
    // actually does rather than whatever this file remembered to try.
    let state = fresh('walkabout');
    const asked = new Set<CueId>();
    const tries: Action[] = [
      { type: 'CAMP' },
      { type: 'FORAGE' },
      { type: 'HUNT' },
      { type: 'FISH' },
    ];
    for (let day = 0; day < 120 && !state.end; day += 1) {
      const action =
        state.event ? ({ type: 'DISMISS_EVENT' } as Action) : tries[day % tries.length]!;
      const next = apply(state, action);
      for (const cue of cuesFor(state, next, action)) asked.add(cue);
      state = next;
    }
    expect(asked.size).toBeGreaterThan(2);
    for (const cue of asked) expect(soundDef(cue)).toBeDefined();
  });
});

// --- 4. The wind is read off the world ---

describe('ambience follows the ground and the season', () => {
  it('is quieter and duller inside the steading than out on the coast', () => {
    const outside = standingOn(fresh(), 'shore');
    const inside = structuredClone(outside);
    inside.modes = [...inside.modes, 'COLONY'];

    const air = ambienceFor(outside);
    const hall = ambienceFor(inside);
    expect(hall.gain).toBeLessThan(air.gain);
    expect(hall.cutoff).toBeLessThan(air.cutoff);
    expect(hall).toEqual(AMBIENCE_INDOORS);
  });

  it('opens up on exposed ground and closes in under trees', () => {
    const shore = ambienceFor(standingOn(fresh(), 'shore'));
    const forest = ambienceFor(standingOn(fresh(), 'forest'));
    expect(shore.cutoff).toBeGreaterThan(forest.cutoff);
    expect(shore.gain).toBeGreaterThan(forest.gain);
  });

  it('is harsher in winter than in summer on the same ground', () => {
    const summer = standingOn(fresh(), 'shore');
    summer.day = 1;
    const winter = standingOn(fresh(), 'shore');
    winter.day = SEASON_LENGTH * 2 + 1;

    const mild = ambienceFor(summer);
    const hard = ambienceFor(winter);
    expect(hard.gain).toBeGreaterThan(mild.gain);
    expect(hard.cutoff).toBeGreaterThan(mild.cutoff);
    expect(hard.gustRate).toBeGreaterThan(mild.gustRate);
  });

  it('drops the wind back for a fight, so the horn has room', () => {
    const quiet = standingOn(fresh(), 'hills');
    const fighting = structuredClone(quiet);
    startBattle(fighting, 'hills', 0);
    expect(ambienceFor(fighting).gain).toBeLessThan(ambienceFor(quiet).gain);
  });

  it('keeps every profile inside what the engine can actually play', () => {
    // A coast has six countries, not eight: `ROUTE_COUNTRY` has no ocean on
    // it and no mountains, because a route runs along the strand.
    const grounds: readonly Terrain[] = ROUTE_COUNTRY;
    for (const ground of grounds) {
      for (const season of [0, 1, 2, 3]) {
        const state = standingOn(fresh(), ground);
        state.day = season * SEASON_LENGTH + 1;
        const air = ambienceFor(state);
        expect(air.cutoff).toBeGreaterThan(20);
        expect(air.cutoff).toBeLessThan(20000);
        expect(air.gain).toBeGreaterThan(0);
        expect(air.gain).toBeLessThan(0.2);
        expect(air.gustRate).toBeGreaterThan(0);
        expect(air.gustDepth).toBeLessThan(1);
      }
    }
  });

  it('does not re-ease toward air it is already blowing', () => {
    const state = standingOn(fresh(), 'meadow');
    expect(sameAir(ambienceFor(state), ambienceFor(structuredClone(state)))).toBe(true);
    // Any other ground; a line has no mountains to walk onto.
    const moved = standingOn(state, 'forest');
    expect(sameAir(ambienceFor(state), ambienceFor(moved))).toBe(false);
  });
});

describe('preferences that outlive a run', () => {
  it('carries a mute set before the shared store forward', async () => {
    // Shipped as the raw string '1'. A player who silenced the game yesterday
    // must still find it silent today, and the value must be rewritten in the
    // new shape so the migration only runs once.
    const held = (() => {
      const map = new Map<string, string>([['landnam_mute', '1']]);
      return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
        clear: () => map.clear(),
        key: () => null,
        length: 0,
      };
    })();
    vi.resetModules();
    (globalThis as Record<string, unknown>).localStorage = held;
    const engine = await import('../src/audio/engine');
    expect(engine.isMuted()).toBe(true);
    expect(held.getItem('landnam_mute')).toBe('true');
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it('stamps a version whenever anything is written', async () => {
    const map = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    };
    vi.resetModules();
    const store = await import('../src/store');
    expect(store.storedVersion()).toBe(0);
    store.write('landnam_taught', ['the-day']);
    expect(store.storedVersion()).toBe(store.PREFS_VERSION);
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it('treats a browser that refuses storage as a player with no preference', async () => {
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
      clear: () => {},
      key: () => null,
      length: 0,
    };
    vi.resetModules();
    const store = await import('../src/store');
    expect(store.read('landnam_taught', store.isStringList, [])).toEqual([]);
    expect(() => store.write('landnam_taught', ['x'])).not.toThrow();
    expect(() => store.forget('landnam_taught')).not.toThrow();
    expect(store.storedVersion()).toBe(0);
    delete (globalThis as Record<string, unknown>).localStorage;
  });
});
