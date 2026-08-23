// `Tidepool Turtle` — the activated SCRY with no {T} in its cost, so the
// Turtle neither turns nor is limited to once a turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TIDEPOOL_TURTLE_SCRIPT } from './tidepoolTurtle';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TURTLE = 'Tidepool Turtle';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function revealedTo(g: Game): InstanceId[] {
  const lib = g.state.zones.library['p1'] ?? [];
  return lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
}

function scried(): { g: Game; turtle: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[TURTLE], []],
    scripts: createRegistry([TIDEPOOL_TURTLE_SCRIPT]),
  });
  const turtle = put(g, 'p1', TURTLE);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: turtle, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  return { g, turtle, revealed: revealedTo(g) };
}

describe('Tidepool Turtle', () => {
  test('the ask is a SCRY — the declined card goes to the bottom, and the Turtle stands', () => {
    const { g, turtle, revealed } = scried();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(false);
    const card = revealed[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [card] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[0]).toBe(card);
    expect(g.state.cards[turtle]?.tapped).toBe(false);
  });

  test('no {T} in the cost, so it scries TWICE in one turn', () => {
    const { g, turtle, revealed } = scried();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: turtle, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = scried();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
