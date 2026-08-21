// `Scouring Sands` — their 1-toughness dies, MY creature is exempt, and
// the scry asks last.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCOURING_SANDS_SCRIPT } from './scouringSands';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scoured(): { g: Game; theirs: InstanceId; mine: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Scouring Sands', 'Aysen Bureaucrats'],
      ['Aysen Bureaucrats'],
    ],
    scripts: createRegistry([SCOURING_SANDS_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Aysen Bureaucrats');
  const theirs = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Scouring Sands', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, theirs, mine, revealed };
}

describe('Scouring Sands', () => {
  test('their 1/1 dies, mine is exempt, and the scry asks', () => {
    const { g, theirs, mine, revealed } = scoured();
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = scoured();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
