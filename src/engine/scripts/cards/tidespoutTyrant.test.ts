// `Tidespout Tyrant` — every spell I cast bounces a permanent; an
// opponent's cast pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TIDESPOUT_TYRANT_SCRIPT } from './tidespoutTyrant';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TYRANT = 'Tidespout Tyrant';
const SPELL = 'Grizzly Bears';
const VICTIM = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(caster: 'p1' | 'p2'): { g: Game; victim: InstanceId; asked: boolean } {
  const g = startedGame({
    players: 2,
    decks: [[TYRANT, SPELL, VICTIM], [SPELL]],
    scripts: createRegistry([TIDESPOUT_TYRANT_SCRIPT]),
  });
  put(g, 'p1', TYRANT);
  const victim = put(g, 'p1', VICTIM);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === caster &&
      s.priority.player === caster &&
      s.priority.awaiting === null &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  const spell = put(g, caster, SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: caster, target: caster, symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: caster, card: spell }));
  const asked = g.state.priority.awaiting?.kind === 'chooseTargets';
  if (asked) {
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  }
  settle(g);
  return { g, victim, asked };
}

describe('Tidespout Tyrant', () => {
  test('MY cast bounces the chosen permanent to its owner', () => {
    const { g, victim, asked } = game('p1');
    expect(asked).toBe(true);
    expect(g.state.cards[victim]?.zone.kind).toBe('hand');
    expect(g.state.cards[victim]?.zone.player).toBe('p1');
  });

  test("an OPPONENT's cast asks nothing", () => {
    expect(game('p2').asked).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = game('p1');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
