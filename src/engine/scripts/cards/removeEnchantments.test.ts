// `Remove Enchantments` — mine come home, the opponent's Aura on my
// creature dies, and their own enchantment on their side is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REMOVE_ENCHANTMENTS_SCRIPT } from './removeEnchantments';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function removed(): { g: Game; mine: InstanceId; aura: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Remove Enchantments', 'Contemplation', 'Grizzly Bears'], ['Pacifism', 'Contemplation']],
    scripts: createRegistry([REMOVE_ENCHANTMENTS_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Contemplation');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Contemplation');
  settle(g);
  holdEverywhere(g);
  // The opponent CASTS Pacifism onto my Bears — a put() Aura is binned
  // by the aura-falls SBA before any attach (D218's lesson).
  const aura = put(g, 'p2', 'Pacifism', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p2', card: aura, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  const spell = put(g, 'p1', 'Remove Enchantments', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, aura, theirs };
}

describe('Remove Enchantments', () => {
  test('mine returns, their Aura on my creature dies, their enchantment stays', () => {
    const { g, mine, aura, theirs } = removed();
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[aura]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = removed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
