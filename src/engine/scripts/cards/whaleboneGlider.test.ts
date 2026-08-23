// `Whalebone Glider` — the power qualifier is ENFORCED at the aim: a 2/2 is a
// legal target and a 6/6 is REFUSED. That refusal is the whole test; without
// it a def that ignored the qualifier would pass just as well.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WHALEBONE_GLIDER_SCRIPT } from './whaleboneGlider';
import { parseTargetClauses } from '../../../data/targetParse';
import { WHALEBONE_GLIDER } from '../../../data/fixtures/engineCards';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GLIDER = 'Whalebone Glider';
const SMALL = 'Grizzly Bears'; // 2/2 — legal
const BIG = 'Grave Titan'; // 6/6 — must be refused

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; glider: InstanceId; small: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GLIDER, SMALL, BIG], []],
    scripts: createRegistry([WHALEBONE_GLIDER_SCRIPT]),
  });
  const small = put(g, 'p1', SMALL);
  const big = put(g, 'p1', BIG);
  const glider = put(g, 'p1', GLIDER);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, glider, small, big };
}

describe('Whalebone Glider', () => {
  test('the power qualifier is DISCLOSED as a structured numeric, not dropped', () => {
    const specs = parseTargetClauses(WHALEBONE_GLIDER.faces[0]?.oracleText ?? '');
    expect(specs).toHaveLength(1);
    expect(specs[0]?.numeric).toEqual({ attr: 'power', cmp: 'atMost', value: 3 });
    expect(specs[0]?.unenforced).toEqual([]);
  });

  test('a 2/2 gains flying', () => {
    const { g, glider, small } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: glider, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: small }] }));
    settle(g);
    const d = deps(createRegistry([WHALEBONE_GLIDER_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, small).keywords.has('flying')).toBe(true);
  });

  test('a 6/6 is REFUSED at the aim — power 3 or less is enforced', () => {
    const { g, glider, big } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: glider, abilityIndex: 0 }));
    const res = g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: big }],
    });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, glider, small } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: glider, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: small }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
