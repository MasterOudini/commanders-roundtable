// `Laid to Rest` — a Human of mine dying is a card, a non-Human is not; a
// creature dying with a +1/+1 counter is 2 life, one without is not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LAID_TO_REST_SCRIPT } from './laidToRest';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const REST = 'Laid to Rest';
const HUMAN = 'Zuran Spellcaster'; // Creature — Human Wizard
const BEARS = 'Grizzly Bears'; // not a Human

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function board(): { g: Game; human: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[REST, HUMAN, BEARS], []],
    scripts: createRegistry([LAID_TO_REST_SCRIPT]),
  });
  put(g, 'p1', REST);
  const human = put(g, 'p1', HUMAN);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, human, bears };
}

function kill(g: Game, card: InstanceId): void {
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
}

describe('Laid to Rest', () => {
  test('a Human dying draws; a non-Human does not', () => {
    const { g, human, bears } = board();
    let logAt = g.log.length;
    kill(g, human);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    logAt = g.log.length;
    kill(g, bears);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('a countered creature dying is 2 life', () => {
    const { g, bears } = board();
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
    kill(g, bears);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('a countered Human pays both', () => {
    const { g, human } = board();
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: human, kind: '+1/+1', delta: 1 }));
    const logAt = g.log.length;
    kill(g, human);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const { g, human } = board();
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: human, kind: '+1/+1', delta: 1 }));
    kill(g, human);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
