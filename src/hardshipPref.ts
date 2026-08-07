// Which hardship the title screen should offer next time.
//
// The SETTING is a preference; the TERMS are on the run. A saga has to
// carry the country it was played in — otherwise a shared seed means two
// different games, and the measured survival rates behind each name stop
// meaning anything at all. So this remembers only what to pre-select on the
// title screen, and `state.hardship` is what the sim reads.

import { read, write } from './store';
import { DEFAULT_HARDSHIP, HARDSHIPS, type HardshipId } from './data/hardship';

const KEY = 'landnam_hardship';

const isHardship = (value: unknown): value is HardshipId =>
  typeof value === 'string' && HARDSHIPS.some((h) => h.id === value);

export function lastHardship(): HardshipId {
  return read(KEY, isHardship, DEFAULT_HARDSHIP);
}

export function rememberHardship(id: HardshipId): void {
  write(KEY, id);
}
