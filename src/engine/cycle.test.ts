// D306 - THE CYCLING SEAM, the engine half: Lonely Sandbar (no script) cycles
// from the hand at instant speed on the opponent's turn - the card goes to the
// graveyard as the cost, a card is drawn on resolution - is refused from the
// battlefield, and replays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SANDBAR = 'Lonely Sandbar';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; sandbar: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SANDBAR, 'Grizzly Bears', 'Coral Eel', 'Forest', 'Forest'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const sandbar = put(g, 'p1', SANDBAR, 'hand');
  settle(g);
  return { g, sandbar };
}

describe('Cycling resolves natively (D306)', () => {
  test('cycled on the opponent turn: the card to the graveyard as the cost, a card drawn', () => {
    const { g, sandbar } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    const library0 = (g.state.zones.library.p1 ?? []).length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sandbar, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[sandbar]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0);
    expect((g.state.zones.library.p1 ?? []).length).toBe(library0 - 1);
  });

  test('from the battlefield it is refused', () => {
    const { g, sandbar } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: sandbar, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: sandbar, abilityIndex: 1 }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, sandbar } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sandbar, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
