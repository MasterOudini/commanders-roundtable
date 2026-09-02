// `Trostani, Three Whispers` — deathtouch for {1}{G}, vigilance for the
// hybrid {G/W} paid green, double strike for {2}{W}; all three on the bear
// in one turn and all gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TROSTANI_THREE_WHISPERS_SCRIPT } from './trostaniThreeWhispers';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TROSTANI = 'Trostani, Three Whispers';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function keywords(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([TROSTANI_THREE_WHISPERS_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function board(): { g: Game; trostani: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TROSTANI, BEARS], []],
    scripts: createRegistry([TROSTANI_THREE_WHISPERS_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const trostani = put(g, 'p1', TROSTANI);
  settle(g);
  return { g, trostani, bears };
}

type Sym = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

function whisper(g: Game, trostani: InstanceId, bears: InstanceId, index: number, mana: [Sym, number][]): void {
  for (const [symbol, amount] of mana) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
  }
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: trostani, abilityIndex: index }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
}

describe('Trostani, Three Whispers', () => {
  test('all three whispers land on the bear and are gone at cleanup', () => {
    const { g, trostani, bears } = board();
    expect(keywords(g, bears).has('deathtouch')).toBe(false);
    whisper(g, trostani, bears, 0, [['G', 1], ['C', 1]]);
    expect(keywords(g, bears).has('deathtouch')).toBe(true);
    whisper(g, trostani, bears, 1, [['G', 1]]);
    expect(keywords(g, bears).has('vigilance')).toBe(true);
    whisper(g, trostani, bears, 2, [['W', 1], ['C', 2]]);
    expect(keywords(g, bears).has('doubleStrike')).toBe(true);
    expect(g.state.cards[trostani]?.tapped).toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const later = keywords(g, bears);
    expect(later.has('deathtouch')).toBe(false);
    expect(later.has('vigilance')).toBe(false);
    expect(later.has('doubleStrike')).toBe(false);
  });

  test('the hybrid whisper takes white as readily as green', () => {
    const { g, trostani, bears } = board();
    whisper(g, trostani, bears, 1, [['W', 1]]);
    expect(keywords(g, bears).has('vigilance')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, trostani, bears } = board();
    whisper(g, trostani, bears, 0, [['G', 1], ['C', 1]]);
    whisper(g, trostani, bears, 2, [['W', 1], ['C', 2]]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
