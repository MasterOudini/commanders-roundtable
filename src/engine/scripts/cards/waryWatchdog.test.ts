// `Wary Watchdog` — the enters-or-dies surveil, both arms. An EXACT-TEXT TWIN of
// `Wary Thespian`; both are generated from one base, and both are tested, because a
// generator that is only proven on one member proves nothing about the other.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WARY_WATCHDOG_SCRIPT } from './waryWatchdog';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Wary Watchdog';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; card: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[CARD], []],
    scripts: createRegistry([WARY_WATCHDOG_SCRIPT]),
  });
  const card = put(g, 'p1', CARD);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, card, revealed };
}

describe('Wary Watchdog', () => {
  test('the entry asks a SURVEIL 1 — toGraveyard, not a scry', () => {
    const { g, revealed } = entered();
    expect(revealed).toHaveLength(1);
    expect(
      g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard,
    ).toBe(true);
  });

  test('a binned card reaches the GRAVEYARD', () => {
    const { g, revealed } = entered();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
    settle(g);
    expect(g.state.cards[top]?.zone.kind).toBe('graveyard');
  });

  test('the DEATH asks a second one', () => {
    const { g, card, revealed } = entered();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = entered();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
