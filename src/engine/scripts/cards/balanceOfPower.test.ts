// `Balance of Power` — draw the HAND DIFFERENCE when behind, nothing when
// not: both branches from one board shape.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BALANCE_OF_POWER_SCRIPT } from './balanceOfPower';
import { BALANCE_OF_POWER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(dumpMyHand: boolean): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Balance of Power', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BALANCE_OF_POWER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  if (dumpMyHand) {
    // Empty my hand except the spell so the difference is large and positive.
    for (const id of [...(g.state.zones.hand['p1'] ?? [])]) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'exile', player: 'p1' } }));
    }
  } else {
    // Empty THEIR hand so the difference is negative — no draw.
    for (const id of [...(g.state.zones.hand['p2'] ?? [])]) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: id, to: { kind: 'exile', player: 'p2' } }));
    }
  }
  const spell = put(g, 'p1', 'Balance of Power', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1; // minus the spell itself
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, before };
}

describe('Balance of Power', () => {
  test('behind on cards, the draw closes the whole gap', () => {
    const { g } = cast(true);
    const mine = (g.state.zones.hand['p1'] ?? []).length;
    const theirs = (g.state.zones.hand['p2'] ?? []).length;
    expect(theirs).toBeGreaterThan(0);
    expect(mine).toBe(theirs);
  });

  test('ahead on cards, nothing is drawn', () => {
    const { g, before } = cast(false);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BALANCE_OF_POWER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BALANCE_OF_POWER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BALANCE_OF_POWER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
