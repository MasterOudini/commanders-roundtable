// `Horizon Chimera` — a draw-TWO pays TWO (one firing per drawn card, the
// D190 fan-out over the D189 marker), and a manual library-to-hand take pays
// NOTHING (the discriminator working end to end).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HORIZON_CHIMERA_SCRIPT } from './horizonChimera';
import { AZORIUS_LOCKET_SCRIPT } from './azoriusLocket';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CHIMERA = 'Horizon Chimera';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chimeraFirings(g: Game, from: number): number {
  return g.log.slice(from).filter((e) => {
    const b = e.body;
    return (
      b.t === 'AbilityPutOnStack' &&
      b.obj.abilityRef === `${HORIZON_CHIMERA_SCRIPT.oracleId}#draw`
    );
  }).length;
}

describe('Horizon Chimera', () => {
  test('a draw-two fires TWICE — once per drawn card — and gains 2', () => {
    const g = startedGame({
      players: 2,
      decks: [[CHIMERA, 'Azorius Locket', 'Forest', 'Forest', 'Forest'], []],
      scripts: createRegistry([HORIZON_CHIMERA_SCRIPT, AZORIUS_LOCKET_SCRIPT]),
    });
    put(g, 'p1', CHIMERA);
    const locket = put(g, 'p1', 'Azorius Locket');
    settle(g);
    const logAt = g.log.length;
    const lifeAt = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(chimeraFirings(g, logAt)).toBe(2);
    expect(g.state.players['p1']?.life).toBe(lifeAt + 2);
  });

  test('a manual library-to-hand take pays nothing', () => {
    const g = startedGame({
      players: 2,
      decks: [[CHIMERA, 'Forest'], []],
      scripts: createRegistry([HORIZON_CHIMERA_SCRIPT]),
    });
    put(g, 'p1', CHIMERA);
    settle(g);
    const logAt = g.log.length;
    const lifeAt = g.state.players['p1']?.life ?? 0;
    put(g, 'p1', 'Forest', 'hand');
    settle(g);
    expect(chimeraFirings(g, logAt)).toBe(0);
    expect(g.state.players['p1']?.life).toBe(lifeAt);
  });

  test("an opponent's draw pays nothing", () => {
    const g = startedGame({
      players: 2,
      decks: [[CHIMERA], []],
      scripts: createRegistry([HORIZON_CHIMERA_SCRIPT]),
    });
    put(g, 'p1', CHIMERA);
    settle(g);
    const logAt = g.log.length;
    // Walk into p2's turn — their draw step fires a DrewCards for p2, and
    // the controller filter must leave the Chimera silent.
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 20_000);
    const p2drew = g.log
      .slice(logAt)
      .some((e) => e.body.t === 'DrewCards' && e.body.player === 'p2');
    expect(p2drew).toBe(true);
    const p1Firings = g.log.slice(logAt).filter((e) => {
      const b = e.body;
      return (
        b.t === 'AbilityPutOnStack' &&
        b.obj.abilityRef === `${HORIZON_CHIMERA_SCRIPT.oracleId}#draw` &&
        b.obj.controller === 'p1'
      );
    });
    // p1's own turn draws (if any happened in the window) legitimately fire;
    // every firing must belong to a p1 draw, never a p2 one.
    const p1Draws = g.log
      .slice(logAt)
      .filter((e) => e.body.t === 'DrewCards' && e.body.player === 'p1')
      .reduce((n, e) => n + (e.body.t === 'DrewCards' ? e.body.cards.length : 0), 0);
    expect(p1Firings.length).toBe(p1Draws);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CHIMERA], []],
      scripts: createRegistry([HORIZON_CHIMERA_SCRIPT]),
    });
    put(g, 'p1', CHIMERA);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
