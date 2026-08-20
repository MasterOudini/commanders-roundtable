// `Lorehold Campus` — the paid scry at #a1 behind the tapped entry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LOREHOLD_CAMPUS_SCRIPT } from './loreholdCampus';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function schooled(): {
  g: Game;
  revealed: InstanceId[];
  enteredTapped: boolean;
} {
  const g = startedGame({
    players: 2,
    decks: [['Lorehold Campus'], ['Grizzly Bears']],
    scripts: createRegistry([LOREHOLD_CAMPUS_SCRIPT]),
  });
  settle(g);
  const campus = put(g, 'p1', 'Lorehold Campus');
  settle(g);
  const enteredTapped = g.state.cards[campus]?.tapped === true;
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [campus], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: campus, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed, enteredTapped };
}

describe('Lorehold Campus', () => {
  test('enters TAPPED; the paid scry reveals one and the bottom answer works', () => {
    const { g, revealed, enteredTapped } = schooled();
    expect(enteredTapped).toBe(true);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(false);
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.zones.library['p1']?.[0]).toBe(revealed[0]);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = schooled();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
