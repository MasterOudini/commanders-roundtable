// `Thundering Falls` — the reminder-FIRST surveil land: it enters tapped by
// D134's built-in rule and its trigger raises the surveil ask.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THUNDERING_FALLS_SCRIPT } from './thunderingFalls';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FALLS = 'Thundering Falls';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; falls: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[FALLS], []],
    scripts: createRegistry([THUNDERING_FALLS_SCRIPT]),
  });
  const falls = put(g, 'p1', FALLS);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, falls, revealed };
}

describe('Thundering Falls', () => {
  test('it enters TAPPED and the entry asks the surveil', () => {
    const { g, falls, revealed } = entered();
    expect(g.state.cards[falls]?.tapped).toBe(true);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    // Surveil, not scry: the card the player declines goes to the GRAVEYARD.
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    expect(revealed).toHaveLength(1);
  });

  test('declining the card puts it in the graveyard', () => {
    const { g, revealed } = entered();
    const card = revealed[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [card] }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
  });

  test('keeping it leaves it on top of the library', () => {
    const { g, revealed } = entered();
    const card = revealed[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [card], toBottom: [] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(card);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = entered();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
