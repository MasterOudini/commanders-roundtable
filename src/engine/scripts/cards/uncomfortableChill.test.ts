// `Uncomfortable Chill` — both of the opponent's creatures lose 2 power until
// cleanup, mine keeps its own, and I draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNCOMFORTABLE_CHILL_SCRIPT } from './uncomfortableChill';
import { UNCOMFORTABLE_CHILL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Uncomfortable Chill';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([UNCOMFORTABLE_CHILL_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function chilled(): { g: Game; mine: InstanceId; theirBears: InstanceId; theirHawk: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [BEARS, NIGHTHAWK]],
    scripts: createRegistry([UNCOMFORTABLE_CHILL_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const mine = put(g, 'p1', BEARS);
  const theirBears = put(g, 'p2', BEARS);
  const theirHawk = put(g, 'p2', NIGHTHAWK);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirBears, theirHawk, logAt };
}

describe('Uncomfortable Chill', () => {
  test('their creatures lose 2 power until cleanup, mine does not, and I draw', () => {
    const { g, mine, theirBears, theirHawk, logAt } = chilled();
    expect(pt(g, theirBears)).toEqual({ power: 0, toughness: 2 });
    expect(pt(g, theirHawk)).toEqual({ power: 0, toughness: 3 });
    expect(pt(g, mine)).toEqual({ power: 2, toughness: 2 });
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, theirBears)).toEqual({ power: 2, toughness: 2 });
    expect(pt(g, theirHawk)).toEqual({ power: 2, toughness: 3 });
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNCOMFORTABLE_CHILL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNCOMFORTABLE_CHILL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNCOMFORTABLE_CHILL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = chilled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
