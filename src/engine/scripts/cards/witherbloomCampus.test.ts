// `Witherbloom Campus` — enters TAPPED; untapped and funded, {4},{T} scries.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WITHERBLOOM_CAMPUS_SCRIPT } from './witherbloomCampus';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LAND = 'Witherbloom Campus';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LAND], []],
    scripts: createRegistry([WITHERBLOOM_CAMPUS_SCRIPT]),
  });
  const land = put(g, 'p1', LAND, 'graveyard');
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'battlefield', player: 'p1' } }),
  );
  settle(g);
  return { g, land };
}

describe('Witherbloom Campus', () => {
  test('it ENTERS TAPPED', () => {
    const { g, land } = game();
    expect(g.state.cards[land]?.tapped).toBe(true);
  });

  test('untapped and funded, ability 1 asks a scry 1 and taps the land', () => {
    const { g, land } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [land], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    expect(g.state.cards[land]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, land } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [land], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
