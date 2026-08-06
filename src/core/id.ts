// Deterministic id generation, scoped per run. No UUIDs — ids must be
// reproducible from the seed for replay/debugging.

export interface IdGen {
  next(prefix: string): string;
  /** Current counter, for serialization. */
  counter(): number;
}

export function makeIdGen(startAt = 0): IdGen {
  let n = startAt;
  return {
    next(prefix: string) {
      n += 1;
      return `${prefix}_${n}`;
    },
    counter() {
      return n;
    },
  };
}
