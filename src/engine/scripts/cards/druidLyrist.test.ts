// `Druid Lyrist` — the self-sacrifice enchantment kill.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRUID_LYRIST_SCRIPT } from './druidLyrist';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LYRIST = 'Druid Lyrist';
const ENCHANTMENT = 'Contemplation';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; lyrist: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LYRIST], [ENCHANTMENT]],
    scripts: createRegistry([DRUID_LYRIST_SCRIPT]),
  });
  const lyrist = put(g, 'p1', LYRIST);
  const theirs = put(g, 'p2', ENCHANTMENT);
  settle(g);
  // {T} in the cost — the Lyrist must be past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  return { g, lyrist, theirs };
}

describe('Druid Lyrist', () => {
  test('destroys the enchantment with the Lyrist spent on the answer', () => {
    const { g, lyrist, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lyrist, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    expect(g.state.cards[lyrist]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, lyrist, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lyrist, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
