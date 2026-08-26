// Migration registry. A save written at version N is run through every
// migration from N up to SAVE_VERSION, in order.
//
// Rules:
//   1. Every SAVE_VERSION bump ships a migration here, even a no-op one.
//   2. Migrations take and return `unknown`-shaped plain data — never import
//      GameState here, because that type describes TODAY's shape, not the
//      shape being migrated.
//   3. Migrations never throw on missing fields; they fill defaults.

import { SAVE_VERSION } from './version';
import { makeShip } from '../sim/ship';
import { SHIP_STRAKES } from '../data/ships';
import { stream } from '../rng';
import { seedPlaces } from '../sim/places';

/** Migrates a save from version N to version N+1. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version being migrated FROM. */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: the BATTLE layer arrived. `battle` is optional and absent
  // means "no fight in progress", so a v1 save needs no reshaping — but the
  // bump still ships a migration, because the registry refuses silent gaps.
  1: (save) => ({ ...save, version: 2 }),

  // v2 -> v3: fighters carry throwables and can raise a shield. A fight saved
  // mid-swing predates both, so give everyone one throw and a lowered shield
  // rather than leaving the fields undefined.
  2: (save) => {
    const battle = save['battle'] as { combatants?: Record<string, unknown>[] } | undefined;
    if (battle?.combatants) {
      battle.combatants = battle.combatants.map((c) => ({
        throwsLeft: 1,
        defending: false,
        ...c,
      }));
    }
    return { ...save, version: 3 };
  },

  // v3 -> v4: fighters have nerve and can break. A fight saved before that
  // had nobody broken, so everyone comes forward steady.
  3: (save) => {
    const battle = save['battle'] as { combatants?: Record<string, unknown>[] } | undefined;
    if (battle?.combatants) {
      battle.combatants = battle.combatants.map((c) => ({
        nerve: 70,
        broken: false,
        fled: false,
        ...c,
      }));
    }
    return { ...save, version: 4 };
  },

  // v4 -> v5: people earn xp. Everyone alive before this existed starts at
  // nothing earned, which is honest: their fights were never counted.
  4: (save) => {
    const party = save['party'] as { people?: Record<string, unknown>[] } | undefined;
    if (party?.people) {
      party.people = party.people.map((p) => ({ xp: 0, ...p }));
    }
    const battle = save['battle'] as {
      foes?: Record<string, unknown>[];
      combatants?: Record<string, unknown>[];
    } | undefined;
    if (battle?.foes) {
      battle.foes = battle.foes.map((p) => ({ xp: 0, ...p }));
    }
    if (battle?.combatants) {
      battle.combatants = battle.combatants.map((c) => ({ kills: 0, ...c }));
    }
    return { ...save, version: 5 };
  },

  // v5 -> v6: the land can be taken. An absent `settlement` already means
  // "still walking", so a v5 save needs no reshaping — but the registry
  // refuses silent gaps, so the bump ships this anyway.
  5: (save) => ({ ...save, version: 6 }),

  // v6 -> v7: the steading has ground of its own and people have jobs. A save
  // made before COLONY existed has a settlement with no plots, so give it an
  // empty list rather than undefined — the renderer iterates it, and a run
  // mid-flight must not crash on load. The plots regenerate on next entry.
  6: (save) => {
    const settlement = save['settlement'] as Record<string, unknown> | undefined;
    if (settlement) {
      save['settlement'] = { plots: [], shelter: 0, watch: 0, ...settlement };
    }
    return { ...save, version: 7 };
  },

  // v7 -> v8: builders raise buildings instead of abstract shelter. A save
  // that accrued shelter the old way keeps it — taking a roof away from a
  // band mid-winter because the model changed would be indefensible — but
  // from here on shelter only moves when something is finished.
  7: (save) => {
    const settlement = save['settlement'] as Record<string, unknown> | undefined;
    if (settlement) {
      save['settlement'] = { built: [], queue: [], works: 0, ...settlement };
    }
    return { ...save, version: 8 };
  },

  // v8 -> v9: the world remembers where the party has walked. An older save
  // has no record of the route, so it starts from where the band is standing
  // — the map draws honestly from here rather than inventing a history.
  8: (save) => {
    const world = save['world'] as Record<string, unknown> | undefined;
    const party = save['party'] as { at?: { q: number; r: number } } | undefined;
    if (world) {
      if (!world['trod']) {
        const at = party?.at;
        world['trod'] = at ? { [`${at.q},${at.r}`]: 1 } : {};
      }
      if (!world['landingName']) world['landingName'] = 'the landing';
    }
    return { ...save, version: 9 };
  },

  // v9 -> v10: raids are fought on the steading, so a battle knows whether it
  // is one. A fight saved mid-swing before this was on open ground by
  // definition — an absent flag already means exactly that.
  9: (save) => ({ ...save, version: 10 }),

  // v10 -> v11: people keep a tally of each other. A band from before this
  // existed was getting along by definition, so it comes forward with none.
  // Personal morale arrived with the feuds, and it lives on the PERSON — so
  // the root-level `grudges: []` is only half the job. A save from before
  // this carried people with no morale at all, and every mood, drift and
  // grudge calculation downstream of it quietly became NaN. Caught by a
  // fixture test years of saves later than it should have been.
  //
  // They come forward at the band's own morale rather than at some neutral
  // number: before this version the warband's figure WAS everyone's figure,
  // so that is the honest reading of what the old save meant.
  10: (save) => {
    const party = save['party'] as
      | { morale?: number; people?: Record<string, unknown>[] }
      | undefined;
    const shared = typeof party?.morale === 'number' ? party.morale : 50;
    if (party?.people) {
      party.people = party.people.map((person) => ({ morale: shared, ...person }));
    }
    return { grudges: [], ...save, version: 11 };
  },

  // v11 -> v12: parties go out from the steading. An absent expedition means
  // everyone is home, which is exactly what an older save describes.
  11: (save) => ({ ...save, version: 12 }),

  // v12 -> v13: the coast has other people on it. An older run comes forward
  // with an empty one rather than having neighbours invented around it —
  // placement needs the worldgen stream and a hex map, neither of which a
  // migration is allowed to reach, and a steading that has never met anybody
  // is a coherent thing for a save to describe.
  12: (save) => ({ neighbours: [], ...save, version: 13 }),

  // v13 -> v14: the band works things out. A run from before this comes
  // forward knowing nothing, which is honest — nobody was keeping track of
  // what it had figured out, so there is nothing to credit it with.
  13: (save) => ({ lore: [], ...save, version: 14 }),

  // v14 -> v15: the band's deeds are counted for the saga. An older run's
  // fights are genuinely unrecoverable — nothing on the state remembers them —
  // so it comes forward at zero and counts from here. The saga leaves out what
  // it cannot honestly claim rather than inventing a number.
  14: (save) => ({
    tally: {
      battles: 0, battlesWon: 0, raids: 0, raidsHeld: 0, foesFelled: 0,
      expeditions: 0, bargains: 0, sackings: 0, seaDays: 0,
    },
    ...save,
    version: 15,
  }),

  // v15 -> v16: a run can now end in a jarldom. Nothing reshapes — an older
  // save simply has no ending with that cause, which is exactly true of it —
  // but the registry refuses silent gaps, so the bump ships this anyway.
  15: (save) => ({ ...save, version: 16 }),

  // v16 -> v17: the band can grow, so a person is now either sworn — one of
  // the ones who bear arms — or a hand who works the steading and never sees
  // a field. Everyone in an older save came off the knarr with a weapon, so
  // they all come forward sworn, which is exactly what they were.
  16: (save) => {
    const party = save['party'] as { people?: Record<string, unknown>[] } | undefined;
    if (party?.people) {
      party.people = party.people.map((person) => ({ bond: 'sworn', ...person }));
    }
    return { ...save, version: 17 };
  },
  // The world gains its places. Re-derived from the save's own seed with the
  // same stream newGame uses, against the SAVED tiles — so an old save gains
  // exactly the places its seed would have been born with, and a world whose
  // generation has since changed still gets places that fit ITS ground.
  17: (save) => {
    const world = save['world'] as Parameters<typeof seedPlaces>[0] | undefined;
    const seed = typeof save['seed'] === 'string' ? (save['seed'] as string) : '';
    if (world && !Array.isArray((world as { places?: unknown }).places)) {
      world.places = seedPlaces(world, stream(seed, 'worldgen').derive('places'), seed);
    }
    return { ...save, version: 18 };
  },
  // Battle gained the optional campId. An old save's battle simply has no
  // camp at stake, which is also what was true when it was written.
  18: (save) => ({ ...save, version: 19 }),
  // Party gained the optional hullHoled. An old save's hull is sound —
  // nothing had ever been able to hole it.
  19: (save) => ({ ...save, version: 20 }),
  // Battle gained warCried and lastBlow. An old save's fight has cried no
  // cry and struck no recorded blow, which is also the truth.
  20: (save) => ({ ...save, version: 21 }),
  // Battle gained the optional champion. A fight saved before this was
  // against men nobody led, which is what an absent field already says.
  21: (save) => ({ ...save, version: 22 }),
  // The jarldom. A run saved before this could not be ruling — the Thing
  // ENDED it — so an absent `jarl` is exactly true of every old save,
  // including the ones that were proclaimed and closed on the spot.
  22: (save) => ({ ...save, version: 23 }),
  // Neighbours can keep a champion who survived a field. Nobody in an older
  // save ever walked off one — champions died with their battle — so an
  // absent `champion` is the truth about every one of them.
  23: (save) => ({ ...save, version: 24 }),
  // The country has a temper now. Every save written before this was played
  // on the terms the game was balanced against, so they come forward as
  // 'even' — which is also what an absent field reads as.
  24: (save) => ({ hardship: 'even', ...save, version: 25 }),
  // People can be kin to one another. An older band came off the knarr as
  // six strangers as far as the save is concerned, and inventing families
  // for them retroactively would rewrite a run's history — so they stay
  // strangers, and only new landings have people in them.
  25: (save) => ({ ...save, version: 26 }),
  // A camp's stores grow back after it is robbed. An older save has no
  // record of who was robbed when, and an absent `sackedOn` reads as "never
  // touched" — which is the kindest true thing to say about a coast whose
  // history the file does not contain, and matches what the old code did.
  26: (save) => ({ ...save, version: 27 }),
  // A fight now records itself as beats as well as prose. A save caught
  // mid-battle by an older build has none, and none is the truth: the beats
  // that would have described the rounds already fought were never emitted,
  // and inventing them would be making up a fight that happened off-camera.
  // An absent list reads as empty everywhere it is consumed, and the rest of
  // the fight beats normally from wherever it is resumed. The `lastBlow`
  // slot the stream replaces is left where it is rather than deleted: it is
  // one small object on one battle, nothing reads it, and a migration that
  // reaches into a nested field to remove something harmless is a migration
  // with more ways to throw than to help.
  27: (save) => ({ ...save, version: 28 }),
  // A run can now be chasing somebody else's mark. Nothing older was
  // started from a challenge code — there were none — so an absent
  // `chasing` is the plain truth about every save before this.
  28: (save) => ({ ...save, version: 29 }),
  // The days outside a fight record themselves as beats now. An older save
  // has none, and none is the truth: the beats that would have described its
  // winters were never emitted, and a stream is for what happens NEXT.
  29: (save) => ({ ...save, version: 30 }),
  // The id counter started at 1 while the six who came off the knarr already
  // held p1..p6, so the first six people ever to join a band took their
  // identities. Everything here is keyed by personId, so a live save can be
  // carrying two people the game cannot tell apart.
  //
  // Two jobs. Push the counter past every id in the file so it cannot happen
  // again, and give the later twin a name of their own.
  //
  // And then STOP, which is the part worth explaining. The obvious next move
  // is to carry references across with the rename — kin, grudges, a fight in
  // progress. It is wrong. Every lookup in this game resolves an id with
  // `find`, which returns the FIRST match, so for as long as the duplicate
  // existed every reference to `p1` reached the founder and none of them
  // ever reached the twin. Rewriting them would hand the twin a history it
  // never had and take the founder's kin away from them. Written the
  // thorough-looking way first, and the test caught it pointing a brother at
  // the wrong brother.
  //
  // The twin was a ghost: it ate, it could die, and nothing could address
  // it. This gives it an identity from here on and invents nothing behind.
  30: (save) => {
    const party = save['party'] as { people?: Record<string, unknown>[] } | undefined;
    const people = party?.people ?? [];

    let highest = 0;
    for (const person of people) {
      const found = /^p(\d+)$/.exec(String(person['id'] ?? ''));
      if (found) highest = Math.max(highest, Number(found[1]));
    }

    const seen = new Set<string>();
    for (const person of people) {
      const id = String(person['id'] ?? '');
      if (!seen.has(id)) {
        seen.add(id);
        continue;
      }
      highest += 1;
      person['id'] = `p${highest}`;
      seen.add(String(person['id']));
    }

    const counter = typeof save['nextId'] === 'number' ? (save['nextId'] as number) : 1;
    return { ...save, nextId: Math.max(counter, highest + 1), version: 31 };
  },
  // The knarr became a thing. `party.hullHoled` was one bit; she has a name
  // and three strakes now. A holed hull comes forward with one strake sprung
  // — the same speed, the same mend, the same night ashore — and a sound one
  // whole. Her name comes off the run's own seed, so a saga reloaded is
  // sailing the ship it was always sailing.
  31: (save) => {
    const seed = typeof save['seed'] === 'string' ? (save['seed'] as string) : '';
    const party = save['party'] as Record<string, unknown> | undefined;
    const wasHoled = Boolean(party?.['hullHoled']);
    const nextParty = { ...(party ?? {}) };
    delete nextParty['hullHoled'];
    return {
      ...save,
      party: nextParty,
      ship: { ...makeShip(seed), strakes: SHIP_STRAKES - (wasHoled ? 1 : 0) },
      version: 32,
    };
  },
  // Settlement gained `children`. Nothing could be born before this, so an
  // empty list is the literal truth about every steading ever saved.
  32: (save) => {
    const home = save['settlement'] as Record<string, unknown> | undefined;
    if (!home) return { ...save, version: 33 };
    return { ...save, settlement: { ...home, children: home['children'] ?? [] }, version: 33 };
  },
  // The root gained the optional `ghost`. Nobody could be haunted before
  // this, so its absence is exactly true of every older save.
  33: (save) => ({ ...save, version: 34 }),
  // Party gained the optional `rations`. Nobody could choose short commons
  // before this, so an absent value is exactly true of every older save.
  34: (save) => ({ ...save, version: 35 }),
  // Nothing to carry: a band that could not walk out never left anybody
  // behind, so absent is the whole truth and the field stays absent.
  35: (save) => ({ ...save, version: 36 }),
  // No hex has been worked, because until now no hex could be. An absent
  // record is exactly that, so the field stays absent and every old valley
  // starts full — which is what it was when the save was written.
  36: (save) => ({ ...save, version: 37 }),
  // An old saga had this coast to itself and keeps it: planting a rival
  // mid-run would drop fences on ground the band may already be standing on,
  // and there is no honest day for him to have landed on. Absent stays absent.
  37: (save) => ({ ...save, version: 38 }),
  // The rocks were always there — they are a function of the seed — but an
  // older band never struck one, so it has learnt nothing about them. An
  // empty chart is the honest record of that, and absent IS the empty chart.
  38: (save) => ({ ...save, version: 39 }),
  // Nothing to strip in practice — the two fields this drops were never
  // written by anything, so no save on earth carries them. The version moves
  // anyway, because the SHAPE changed and a save's shape is the contract.
  39: (save) => ({ ...save, version: 40 }),
  // An older band broke no ground, because it could not. Absent is that,
  // and inventing roads for a run that never dug them would rewrite what it
  // spent its days on.
  40: (save) => ({ ...save, version: 41 }),
  // Nobody was ever driven out, because there was no way to do it. Absent is
  // exactly that, and inventing enemies for an old saga would be inventing
  // judgements it never made.
  41: (save) => ({ ...save, version: 42 }),
  // Nobody was ever away over the open sea, because there was nowhere to go.
  // Absent is that, and a ship at sea is not a thing to invent for a saga
  // that never launched one.
  42: (save) => ({ ...save, version: 43 }),
  // Nobody was ever out at the fishing, because there was nowhere worth
  // fishing. An old expedition keeps whatever purpose it launched under; the
  // new one is only ever chosen going forward.
  43: (save) => ({ ...save, version: 44 }),
  // v44 -> v45: a fighter has a place in the LINE now, not just a hex. Rank 1
  // is the front. Nothing reads it yet, so a fight saved mid-swing carries on
  // untouched — the ranks just have to exist and be sane. Ranked per side, in
  // the order the combatants are stored, which is the order they deployed.
  44: (save) => {
    const battle = save['battle'] as { combatants?: Record<string, unknown>[] } | undefined;
    if (battle?.combatants) {
      const seen: Record<string, number> = {};
      battle.combatants = battle.combatants.map((c) => {
        const side = typeof c['side'] === 'string' ? (c['side'] as string) : 'warband';
        seen[side] = (seen[side] ?? 0) + 1;
        return { ...c, rank: seen[side] };
      });
    }
    return { ...save, version: 45 };
  },
  // v45 -> v46: a `moved` beat says which RANK a fighter left and which they
  // took. An old one names two hexes on a field that no longer exists, and
  // there is no honest rank to translate them into. Beats are a capped,
  // drainable presentation stream, so the old ones are dropped rather than
  // guessed at — the worst that costs is one un-animated step in a fight
  // that was saved mid-swing.
  45: (save) => {
    const battle = save['battle'] as { beats?: Record<string, unknown>[] } | undefined;
    if (battle?.beats) {
      battle.beats = battle.beats.filter((b) => b['kind'] !== 'moved');
    }
    return { ...save, version: 46 };
  },
  // v46 -> v47: a fighter has no hex. Strip `at` from the combatants, and the
  // `from`/`to` hexes from any `shoved` beat still in the stream.
  //
  // A `drowned` shove goes with them. It was the best thing the verb did —
  // put a man in the water and the sea finished him for nothing — and a line
  // has no water, so it has been unreachable since 8.1c. The beats it left
  // behind name a result the type no longer has, so they are dropped rather
  // than left to be rendered by a branch that is also gone.
  46: (save) => {
    const battle = save['battle'] as {
      combatants?: Record<string, unknown>[];
      beats?: Record<string, unknown>[];
    } | undefined;
    if (battle?.combatants) {
      battle.combatants = battle.combatants.map((c) => {
        const { at: _at, ...rest } = c as { at?: unknown };
        return rest as Record<string, unknown>;
      });
    }
    if (battle?.beats) {
      battle.beats = battle.beats
        .filter((b) => !(b['kind'] === 'shoved' && b['result'] === 'drowned'))
        .map((b) => {
          if (b['kind'] !== 'shoved') return b;
          const { from: _from, to: _to, ...rest } = b as { from?: unknown; to?: unknown };
          return rest as Record<string, unknown>;
        });
    }
    return { ...save, version: 47 };
  },
  // v47 -> v48: the band gains a place on the coast. Nothing to work out —
  // a saga that has never walked the line has not left the landing, and
  // `standingAt` reads an absent stop as 0 anyway. The bump exists so the
  // field is declared rather than appearing from nowhere.
  47: (save) => ({ ...save, version: 48 }),
  // v48 -> v49: places may name a stop on the coast. An old world's places
  // stand on hexes and always will — there is no honest stop to invent for
  // them, and inventing one would put a monastery somewhere the band could
  // walk to on a coast that world was never seeded with.
  48: (save) => ({ ...save, version: 49 }),

};

export interface MigrationResult {
  save: Record<string, unknown>;
  /** How many migrations ran. */
  applied: number;
}

/**
 * Walks a save up to the current version. Throws only if a version gap has
 * no registered migration — which means someone bumped without migrating.
 */
export function migrate(raw: Record<string, unknown>): MigrationResult {
  let save = raw;
  let version = typeof save['version'] === 'number' ? (save['version'] as number) : 0;
  let applied = 0;

  if (version > SAVE_VERSION) {
    throw new Error(`save is from a newer version (${version} > ${SAVE_VERSION})`);
  }

  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      throw new Error(`no migration registered from save version ${version}`);
    }
    save = step(save);
    applied += 1;
    const next = typeof save['version'] === 'number' ? (save['version'] as number) : version + 1;
    if (next <= version) {
      throw new Error(`migration from ${version} did not advance the version`);
    }
    version = next;
  }

  return { save, applied };
}
