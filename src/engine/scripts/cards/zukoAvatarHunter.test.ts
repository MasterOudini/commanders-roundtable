// `Zuko, Avatar Hunter` — a RED cast of mine makes a 2/2 Soldier; a green
// cast does not; an opponent's red cast does not. And Zuko reaches.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZUKO_AVATAR_HUNTER_SCRIPT } from './zukoAvatarHunter';
import { advanceUntil, battlefieldOf, deps, must, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ZUKO = 'Zuko, Avatar Hunter';
const RED = 'Cyclops of One-Eyed Pass'; // {2}{R}{R}
const GREEN = 'Grizzly Bears'; // {1}{G}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiers(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Soldier').length;
}

function board(): { g: Game; zuko: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [ZUKO, RED, GREEN],
      [RED],
    ],
    scripts: createRegistry([ZUKO_AVATAR_HUNTER_SCRIPT]),
  });
  const zuko = put(g, 'p1', ZUKO);
  settle(g);
  return { g, zuko };
}

function castMine(g: Game, name: string, symbol: 'R' | 'G'): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  const card = put(g, 'p1', name, 'hand');
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  settle(g);
}

describe('Zuko, Avatar Hunter', () => {
  test('my RED cast makes one 2/2 Soldier', () => {
    const { g } = board();
    castMine(g, RED, 'R');
    expect(soldiers(g)).toBe(1);
  });

  test('my GREEN cast makes nothing', () => {
    const { g } = board();
    castMine(g, GREEN, 'G');
    expect(soldiers(g)).toBe(0);
  });

  test("an OPPONENT's red cast makes me nothing", () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'R', amount: 4 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 4 }));
    const card = put(g, 'p2', RED, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p2', card }));
    settle(g);
    expect(soldiers(g)).toBe(0);
  });

  test('Zuko reaches, on the line the def does not claim', () => {
    const { g, zuko } = board();
    const d = deps(createRegistry([ZUKO_AVATAR_HUNTER_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, zuko).keywords.has('reach')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    castMine(g, RED, 'R');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
