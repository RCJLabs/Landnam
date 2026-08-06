// Every tunable number in the game lives here. Balance passes edit this
// file and content tables only — never engine code.

export const BALANCE = {
  chart: {
    width: 44,
    height: 26,
    fogRadius: 2,
    pathMin: 34, // reroll charts whose Norway->Vinland sea path is outside these
    pathMax: 60,
    maxRerolls: 20,
    stormSeedCount: [2, 4] as const, // min/max wandering storms
  },
  ship: {
    hullMax: 20,
    cargoMax: 60,
    stormHullDamage: [2, 4] as const,
    stormMoraleHit: 8,
  },
  crew: {
    startCount: 8,
    hpBase: 10,
    foodPerCrewPerMove: 0.25, // one food unit feeds 4 crew for one move
    waterPerCrewPerMove: 0.25,
  },
  resources: {
    startFood: 30,
    startWater: 30,
    startSilver: 20,
    startTimber: 4,
  },
  sailing: {
    // Supplies-relevant costs to enter a sea hex, modified by wind.
    baseMoveCost: 1,
    adverseWindExtra: 1, // moving within 1 dir of straight upwind
    stormEntryExtra: 1,
    moveMoralePenaltyStarving: 5,
    starvationHpLoss: 2,
    repairTimberPerHull: 1,
  },
  morale: {
    start: 70,
    max: 100,
    mutinyThreshold: 20,
    victoryFameBase: 100,
  },
} as const;
