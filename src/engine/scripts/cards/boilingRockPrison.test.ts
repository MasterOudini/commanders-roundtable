// `Boiling Rock Prison` — enters tapped (the built-in), draws on the
// sacrifice (the def).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOILING_ROCK_PRISON_SCRIPT } from './boilingRockPrison';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PRISON = 'Boiling Rock Prison';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; prison: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PRISON], []],
    scripts: createRegistry([BOILING_ROCK_PRISON_SCRIPT]),
  });
  const prison = put(g, 'p1', PRISON, 'graveyard');
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: prison, to: { kind: 'battlefield', player: 'p1' } }),
  );
  settle(g);
  return { g, prison };
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
        ),
    ).length;
}

describe('Boiling Rock Prison', () => {
  test('enters tapped; the sacrifice-draw needs it untapped first, then draws', () => {
    const { g, prison } = game();
    expect(g.state.cards[prison]?.tapped).toBe(true);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [prison], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: prison, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[prison]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, prison } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [prison], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: prison, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
