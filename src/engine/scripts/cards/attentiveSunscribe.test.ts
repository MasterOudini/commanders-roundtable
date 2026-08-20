// `Attentive Sunscribe` — becomes-tapped scry 1: Emmara's filter (every tap
// path counts, here the wrench) raising the ask, and someone ELSE'S tap
// paying nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ATTENTIVE_SUNSCRIBE_SCRIPT } from './attentiveSunscribe';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; scribe: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Attentive Sunscribe', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ATTENTIVE_SUNSCRIBE_SCRIPT]),
  });
  const scribe = put(g, 'p1', 'Attentive Sunscribe');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  return { g, scribe, bears };
}

describe('Attentive Sunscribe', () => {
  test('tapping it asks; the answer clears the prompt', () => {
    const { g, scribe } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [scribe], tapped: true }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect((g.state.zones.library['p1'] ?? [])[0]).toBe(revealed[0]);
  });

  test('tapping a DIFFERENT permanent pays nothing', () => {
    const { g, bears } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const { g, scribe } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [scribe], tapped: true }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
