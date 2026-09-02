// `Aether Spellbomb` — the bounce sends a creature to its OWNER's hand with
// the Spellbomb spent; the draw is the other way to spend it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AETHER_SPELLBOMB_SCRIPT } from './aetherSpellbomb';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELLBOMB = 'Aether Spellbomb';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player),
    ).length;
}

function board(): { g: Game; bomb: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELLBOMB], [BEARS]],
    scripts: createRegistry([AETHER_SPELLBOMB_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  const bomb = put(g, 'p1', SPELLBOMB);
  settle(g);
  return { g, bomb, bears };
}

describe('Aether Spellbomb', () => {
  test('{U}, sacrifice: the opponent creature goes to its owner hand', () => {
    const { g, bomb, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bomb, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[bomb]?.zone.kind).toBe('graveyard');
  });

  test('{1}, sacrifice: draw a card', () => {
    const { g, bomb } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bomb, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[bomb]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bomb, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bomb, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
