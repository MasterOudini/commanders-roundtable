// `Botanical Plaza` — enters tapped; the sacrifice-draw pays {2}{G}{W}.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOTANICAL_PLAZA_SCRIPT } from './botanicalPlaza';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PLAZA = 'Botanical Plaza';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; plaza: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PLAZA], []],
    scripts: createRegistry([BOTANICAL_PLAZA_SCRIPT]),
  });
  const plaza = put(g, 'p1', PLAZA, 'graveyard');
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: plaza, to: { kind: 'battlefield', player: 'p1' } }),
  );
  settle(g);
  return { g, plaza };
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

describe('Botanical Plaza', () => {
  test('enters tapped; untapped and funded, the sacrifice draws', () => {
    const { g, plaza } = game();
    expect(g.state.cards[plaza]?.tapped).toBe(true);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [plaza], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: plaza, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[plaza]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, plaza } = game();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [plaza], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: plaza, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
