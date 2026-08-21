// `Soulsworn Jury` — the Jury sacrifices itself to counter a REAL held
// creature cast; the typed-spell aim enforced.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOULSWORN_JURY_SCRIPT } from './soulswornJury';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function juried(): { g: Game; jury: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Soulsworn Jury'], ['Grizzly Bears']],
    scripts: createRegistry([SOULSWORN_JURY_SCRIPT]),
  });
  holdEverywhere(g);
  const jury = put(g, 'p1', 'Soulsworn Jury');
  const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 4 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(
    g,
    (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null,
    20_000,
  );
  const stackId = g.state.stack[0]?.id as string;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: jury, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, jury, bears };
}

describe('Soulsworn Jury', () => {
  test('the Jury dies for its cost and the Bears is countered', () => {
    const { g, jury, bears } = juried();
    expect(g.state.cards[jury]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = juried();
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
