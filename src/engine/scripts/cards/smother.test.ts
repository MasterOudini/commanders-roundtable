// `Smother` — the mana-value floor is ENFORCED at the aim: a 6-cost Titan is
// refused, the 2-cost Bears dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SMOTHER_SCRIPT } from './smother';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function smothered(): { g: Game; bears: InstanceId; titan: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Smother'], ['Grizzly Bears', 'Grave Titan']],
    scripts: createRegistry([SMOTHER_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const titan = put(g, 'p2', 'Grave Titan');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Smother', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const refused = g.submit({
    t: 'ChooseTargets',
    player: 'p1',
    targets: [{ kind: 'card', id: titan }],
  });
  if (refused.ok) throw new Error('a mana value 6 creature must be refused');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, titan };
}

describe('Smother', () => {
  test('the Titan is refused at the aim; the Bears dies', () => {
    const { g, bears, titan } = smothered();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[titan]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = smothered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
