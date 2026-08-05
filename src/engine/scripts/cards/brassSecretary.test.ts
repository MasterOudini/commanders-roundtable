// `Brass Secretary` — the sacrifice-draw on a creature body, no sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRASS_SECRETARY_SCRIPT } from './brassSecretary';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SECRETARY = 'Brass Secretary';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; sec: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SECRETARY], []],
    scripts: createRegistry([BRASS_SECRETARY_SCRIPT]),
  });
  const sec = put(g, 'p1', SECRETARY);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, sec };
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

describe('Brass Secretary', () => {
  test('draws a card with the Secretary spent as part of the cost', () => {
    const { g, sec } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sec, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[sec]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, sec } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sec, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
