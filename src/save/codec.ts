// GameRun <-> plain JSON. The only non-JSON structure in the state is the
// discovered Set; keep this the single place that knows that.

import { GameRun } from '../sim/types';

export function encodeRun(run: GameRun): string {
  return JSON.stringify({
    ...run,
    chart: { ...run.chart, discovered: [...run.chart.discovered].sort() },
  });
}

export function decodeRun(json: string): GameRun {
  const raw = JSON.parse(json) as Omit<GameRun, 'chart'> & {
    chart: Omit<GameRun['chart'], 'discovered'> & { discovered: string[] };
  };
  return {
    ...raw,
    chart: { ...raw.chart, discovered: new Set(raw.chart.discovered) },
  };
}
