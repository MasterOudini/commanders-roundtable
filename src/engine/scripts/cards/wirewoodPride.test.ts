// `Wirewood Pride` — X counts Elves on the WHOLE battlefield, so the
// opponent's Elves count too. The two seats get different Elf counts so a
// "mine only" reading cannot pass.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WIREWOOD_PRIDE_SCRIPT } from './wirewoodPride';
import { WIREWOOD_PRIDE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Wirewood Pride';
const ELF = 'Llanowar Elves'; // 1/1 Elf
const BEARS = 'Grizzly Bears'; // not an Elf

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p1 gets ONE Elf plus the target; p2 gets TWO Elves. X should be 3. */
function cast(): { g: Game; target: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, ELF, BEARS],
      [ELF, ELF],
    ],
    scripts: createRegistry([WIREWOOD_PRIDE_SCRIPT]),
  });
  const target = put(g, 'p1', BEARS);
  put(g, 'p1', ELF);
  put(g, 'p2', ELF);
  put(g, 'p2', ELF);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target };
}

describe('Wirewood Pride', () => {
  test('X counts BOTH seats: a 2/2 becomes 5/5, not 3/3', () => {
    const { g, target } = cast();
    const d = deps(createRegistry([WIREWOOD_PRIDE_SCRIPT]));
    const got = derive(g.state, d.oracle, d.scripts, target);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 5, toughness: 5 });
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WIREWOOD_PRIDE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WIREWOOD_PRIDE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WIREWOOD_PRIDE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
