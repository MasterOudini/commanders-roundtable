// `Eidolon of Philosophy` — three cards, the Eidolon spent as part of the
// cost.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EIDOLON_OF_PHILOSOPHY_SCRIPT } from './eidolonOfPhilosophy';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const EIDOLON = 'Eidolon of Philosophy';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log.slice(from).reduce(
    (n, e) =>
      e.body.t === 'CardsMoved'
        ? n +
          e.body.moves.filter(
            (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
          ).length
        : n,
    0,
  );
}

function game(): { g: Game; eidolon: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[EIDOLON], []],
    scripts: createRegistry([EIDOLON_OF_PHILOSOPHY_SCRIPT]),
  });
  const eidolon = put(g, 'p1', EIDOLON);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
  return { g, eidolon };
}

describe('Eidolon of Philosophy', () => {
  test('draws THREE with the Eidolon spent at activation', () => {
    const { g, eidolon } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: eidolon, abilityIndex: 0, targets: [] }));
    expect(g.state.cards[eidolon]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g, eidolon } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: eidolon, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
