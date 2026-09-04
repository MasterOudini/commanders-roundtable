// D304 - CR 704.5m's other half: an Aura's own Enchant ability keeps judging its
// host on every state-based pass. "Enchant creature you control" admits the
// creature the opponent took no more than it did at the cast, so the Aura falls
// off; attached to your own creature it stays. Emblem of the Warmind carries no
// script here - the check is the engine's, asked of the spec the cast used.

import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const AURA = 'Emblem of the Warmind';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; aura: InstanceId; host: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[AURA, 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', 'Grizzly Bears');
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const aura = put(g, 'p1', AURA, 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura, targets: [{ kind: 'card', id: host }] }));
  settle(g);
  return { g, aura, host };
}

describe('CR 704.5m - the Enchant ability keeps judging the host (D304)', () => {
  test('attached to your own creature it stays', () => {
    const { g, aura, host } = board();
    expect(g.state.cards[aura]?.attachedTo).toBe(host);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(g.state.cards[aura]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[aura]?.attachedTo).toBe(host);
  });

  test('when the opponent takes the creature, "Enchant creature you control" no longer admits it: the Aura falls off, the creature stays', () => {
    const { g, aura, host } = board();
    must(g.submit({ t: 'ManualSetController', player: 'p1', card: host, controller: 'p2' }));
    settle(g);
    expect(g.state.cards[host]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[aura]?.zone.kind).toBe('graveyard');
  });
});
