// `Kishla Village` — the paid surveil at #a1, behind the conditional
// tapped entry (no Island or Swamp: tapped).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KISHLA_VILLAGE_SCRIPT } from './kishlaVillage';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function villaged(): {
  g: Game;
  village: InstanceId;
  revealed: InstanceId[];
  enteredTapped: boolean;
} {
  const g = startedGame({
    players: 2,
    decks: [['Kishla Village'], ['Grizzly Bears']],
    scripts: createRegistry([KISHLA_VILLAGE_SCRIPT]),
  });
  settle(g);
  const village = put(g, 'p1', 'Kishla Village');
  settle(g);
  const enteredTapped = g.state.cards[village]?.tapped === true;
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [village], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: village, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, village, revealed, enteredTapped };
}

describe('Kishla Village', () => {
  test('enters TAPPED with no Island or Swamp; the paid surveil reveals two', () => {
    const { g, revealed, enteredTapped } = villaged();
    expect(enteredTapped).toBe(true);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    expect(revealed).toHaveLength(2);
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = villaged();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed].reverse(), toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
