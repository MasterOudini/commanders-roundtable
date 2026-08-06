// `Etherium Astrolabe` — an artifact pays (itself included), and the draw
// arrives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ETHERIUM_ASTROLABE_SCRIPT } from './etheriumAstrolabe';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ASTROLABE = 'Etherium Astrolabe';
const BEARS = 'Grizzly Bears';

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

function board(): { g: Game; astrolabe: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ASTROLABE, BEARS], []],
    scripts: createRegistry([ETHERIUM_ASTROLABE_SCRIPT]),
  });
  const astrolabe = put(g, 'p1', ASTROLABE);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, astrolabe, bears };
}

describe('Etherium Astrolabe', () => {
  test('pays with ITSELF — an artifact is an artifact (CR 113.7a) — and draws', () => {
    const { g, astrolabe } = board();
    const logAt = g.log.length;
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: astrolabe, abilityIndex: 0, sacrifice: astrolabe }),
    );
    expect(g.state.cards[astrolabe]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('a CREATURE cannot pay the artifact-only cost', () => {
    const { g, astrolabe, bears } = board();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: astrolabe, abilityIndex: 0, sacrifice: bears });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, astrolabe } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: astrolabe, abilityIndex: 0, sacrifice: astrolabe }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
