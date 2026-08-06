// App shell: owns the current run, the board, and screen transitions.
// Flow: UI/board input -> StrategicIntent -> stepStrategic -> apply -> persist -> re-render.

import { distance, eq } from '../core/hex';
import { generateSeed, makeRng } from '../core/rng';
import { makeBattle } from '../sim/tactical/battle';
import { raidById } from '../content/raids';
import { GameRun, StrategicIntent, TacticalIntent } from '../sim/types';
import { newRun } from '../sim/strategic/state';
import { stepStrategic } from '../sim/strategic/sail';
import { canAct } from '../sim/tactical/actions';
import { loadMeta, saveMeta, loadRun, saveRun, clearRun } from '../save/persist';
import { HexBoard } from '../render/canvasHex';
import { drawChart } from '../render/chartRender';
import { battleCenter, drawBattle } from '../render/battleRender';
import { renderBattleHud, renderBattleResult } from '../ui/battleHud';
import { renderHud } from '../ui/hud';
import { renderRunEnd } from '../ui/runEnd';
import { renderTitle } from '../ui/title';
import { renderEventPanel } from '../ui/eventPanel';
import { renderPortPanel } from '../ui/portPanel';
import { renderCrewPanel } from '../ui/crewPanel';
import { must, replaceChildren } from '../ui/dom';

export class App {
  private run: GameRun | null = null;
  private board: HexBoard | null = null;
  private meta = loadMeta();
  private crewPanelOpen = false;
  private selectedUnitId: string | null = null;
  private pendingPush = false;
  /** Which layer the camera is set up for. */
  private boardMode: 'chart' | 'battle' = 'chart';
  private overlayRoot = must<HTMLDivElement>('overlay-root');
  private hudRoot = must<HTMLDivElement>('hud-root');
  private canvas = must<HTMLCanvasElement>('board');

  start(): void {
    const saved = loadRun();
    if (saved && saved.phase !== 'ended') {
      this.showTitle(true);
    } else {
      this.showTitle(false);
    }
  }

  private showTitle(hasSave: boolean): void {
    replaceChildren(
      this.overlayRoot,
      renderTitle(
        this.meta,
        hasSave,
        () => {
          const saved = loadRun();
          if (saved) this.beginRun(saved);
          else this.startNewRun();
        },
        (seed) => this.startNewRun(seed),
      ),
    );
  }

  private startNewRun(seed?: string): void {
    const finalSeed = seed || generateSeed(this.entropy());
    const run = newRun(finalSeed);
    saveRun(run);
    this.beginRun(run);
  }

  /** User-triggered entropy: derived from meta so it changes per run without Date.now in sim. */
  private entropy(): number {
    return (this.meta.runsPlayed + 1) * 7919 + this.meta.fame * 13 + performance.now() | 0;
  }

  private beginRun(run: GameRun): void {
    this.run = run;
    replaceChildren(this.overlayRoot);
    if (!this.board) {
      this.board = new HexBoard(this.canvas, 26, {
        draw: (ctx, board) => {
          const r = this.run;
          if (!r) return;
          if (r.phase === 'battle' && r.activeBattle) {
            drawBattle(ctx, board, r.activeBattle, { unitId: this.selectedUnitId });
          } else {
            drawChart(ctx, board, r);
          }
        },
        onClick: (hex) => this.onHexClick(hex),
        onHover: () => {},
      });
    }
    this.board.centerOn(run.chart.shipAt);
    this.renderAll();
  }

  private onHexClick(hex: { q: number; r: number }): void {
    const run = this.run;
    if (!run) return;
    if (run.phase === 'battle' && run.activeBattle) {
      this.onBattleClick(hex);
      return;
    }
    if (run.phase !== 'voyage') return;
    if (distance(hex, run.chart.shipAt) === 1) {
      this.dispatch({ type: 'SAIL', to: hex });
    }
  }

  private onBattleClick(hex: { q: number; r: number }): void {
    const run = this.run!;
    const battle = run.activeBattle!;
    if (battle.result) return;
    const clicked = battle.units.find((u) => u.alive && !u.escaped && eq(u.at, hex));

    if (clicked && clicked.side === 'player') {
      this.selectedUnitId = clicked.id === this.selectedUnitId ? null : clicked.id;
      this.pendingPush = false;
      this.renderAll();
      return;
    }
    const sel = this.selectedUnitId
      ? battle.units.find((u) => u.id === this.selectedUnitId)
      : undefined;
    if (!sel) return;
    if (clicked && clicked.side === 'enemy') {
      const push = this.pendingPush;
      this.pendingPush = false;
      this.dispatch(
        push
          ? { type: 'T_PUSH', unitId: sel.id, targetId: clicked.id }
          : { type: 'T_STRIKE', unitId: sel.id, targetId: clicked.id },
      );
      return;
    }
    if (!clicked && canAct(sel) === false && sel.movesLeft <= 0) return;
    if (!clicked) {
      this.dispatch({ type: 'T_MOVE', unitId: sel.id, to: hex });
    }
  }

  private dispatch(intent: StrategicIntent | TacticalIntent): void {
    const run = this.run;
    if (!run) return;
    const { run: next, events } = stepStrategic(run, intent);
    if (next === run) return; // rejected intent
    this.run = next;
    saveRun(next);

    if (next.phase === 'ended' && next.end) {
      this.meta.fame += next.end.fame;
      this.meta.runsPlayed += 1;
      if (next.end.outcome === 'victory') this.meta.victories += 1;
      saveMeta(this.meta);
      clearRun();
    }

    // Keep the camera loosely following the ship.
    for (const e of events) {
      if (e.type === 'MOVED' && this.board) this.board.centerOn(e.to);
    }
    this.renderAll();
  }

  /** Debug/test hook: jump straight into a raid battle on the current run. */
  debugStartBattle(raidId = 'monastery'): void {
    const run = this.run;
    if (!run || run.phase !== 'voyage') return;
    const next = structuredClone(run);
    next.activeBattle = makeBattle(
      raidById(raidId),
      next.crew,
      0,
      makeRng(next.seed).fork(`debug-battle:${next.turn}`),
    );
    next.phase = 'battle';
    this.run = next;
    saveRun(next);
    this.renderAll();
  }

  private toggleCrewPanel = (): void => {
    this.crewPanelOpen = !this.crewPanelOpen;
    this.renderAll();
  };

  private renderAll(): void {
    const run = this.run;
    if (!run) return;

    // Camera/board mode transitions between layers.
    if (run.phase === 'battle' && run.activeBattle) {
      if (this.boardMode !== 'battle' && this.board) {
        this.boardMode = 'battle';
        this.board.hexSize = 42;
        this.board.zoom = 1;
        this.board.centerOn(battleCenter(run.activeBattle));
      }
    } else if (this.boardMode !== 'chart' && this.board) {
      this.boardMode = 'chart';
      this.board.hexSize = 26;
      this.selectedUnitId = null;
      this.board.centerOn(run.chart.shipAt);
    }

    if (run.phase === 'battle' && run.activeBattle) {
      renderBattleHud(
        this.hudRoot,
        run,
        run.activeBattle,
        this.selectedUnitId,
        this.pendingPush,
        () => {
          this.pendingPush = !this.pendingPush;
          this.renderAll();
        },
        (i) => this.dispatch(i),
      );
    } else {
      renderHud(this.hudRoot, run, (intent) => this.dispatch(intent), this.toggleCrewPanel);
    }

    // Overlay per phase.
    if (run.phase === 'ended' && run.end) {
      replaceChildren(this.overlayRoot, renderRunEnd(run, () => this.startNewRun()));
    } else if (this.crewPanelOpen) {
      replaceChildren(this.overlayRoot, renderCrewPanel(run, this.toggleCrewPanel));
    } else if (run.phase === 'event' && run.activeEvent) {
      replaceChildren(this.overlayRoot, renderEventPanel(run, (i) => this.dispatch(i)));
    } else if (run.phase === 'port' && run.activePort) {
      replaceChildren(this.overlayRoot, renderPortPanel(run, (i) => this.dispatch(i)));
    } else if (run.phase === 'battle' && run.activeBattle?.result) {
      replaceChildren(this.overlayRoot, renderBattleResult(run.activeBattle, (i) => this.dispatch(i)));
    } else {
      replaceChildren(this.overlayRoot);
    }
    this.board?.requestDraw();
  }
}
