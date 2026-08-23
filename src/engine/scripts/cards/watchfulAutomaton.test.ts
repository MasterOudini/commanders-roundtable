// `Watchful Automaton` — no {T} in the cost, so it scries TWICE in one turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WATCHFUL_AUTOMATON_SCRIPT } from './watchfulAutomaton';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const AUTOMATON = 'Watchful Automaton';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answerScry(g: Game): void {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
  settle(g);
}

function board(): { g: Game; automaton: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[AUTOMATON], []],
    scripts: createRegistry([WATCHFUL_AUTOMATON_SCRIPT]),
  });
  const automaton = put(g, 'p1', AUTOMATON);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  return { g, automaton };
}

describe('Watchful Automaton', () => {
  test('it scries, and does NOT tap doing it', () => {
    const { g, automaton } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: automaton, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    expect(g.state.cards[automaton]?.tapped).toBe(false);
  });

  test('it goes TWICE in one turn — no {T} in the cost', () => {
    const { g, automaton } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: automaton, abilityIndex: 0 }));
    answerScry(g);
    const again = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: automaton,
      abilityIndex: 0,
    });
    expect(again.ok).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, automaton } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: automaton, abilityIndex: 0 }));
    answerScry(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
