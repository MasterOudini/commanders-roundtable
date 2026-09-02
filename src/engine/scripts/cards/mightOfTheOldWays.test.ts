// `Might of the Old Ways` — +2/+2 always; the Coven card only when three of
// my creatures have three DIFFERENT powers, counted after the pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MIGHT_OF_THE_OLD_WAYS_SCRIPT } from './mightOfTheOldWays';
import { MIGHT_OF_THE_OLD_WAYS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Might of the Old Ways';
const BEARS = 'Grizzly Bears'; // 2/2
const TITAN = 'Grave Titan'; // 6/6
const WIZARD = 'Zuran Spellcaster'; // 1/1

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

function cast(creatures: readonly string[]): { g: Game; bears: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, ...creatures], []],
    scripts: createRegistry([MIGHT_OF_THE_OLD_WAYS_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  for (const name of creatures) put(g, 'p1', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, logAt };
}

function power(g: Game, id: InstanceId): number | null {
  const d = deps(createRegistry([MIGHT_OF_THE_OLD_WAYS_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).power;
}

describe('Might of the Old Ways', () => {
  test('powers 4, 6 and 1 after the pump: Coven draws', () => {
    const { g, bears, logAt } = cast([TITAN, WIZARD]);
    expect(power(g, bears)).toBe(4);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('only two different powers: the pump alone', () => {
    const { g, bears, logAt } = cast([TITAN]);
    expect(power(g, bears)).toBe(4);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MIGHT_OF_THE_OLD_WAYS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MIGHT_OF_THE_OLD_WAYS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MIGHT_OF_THE_OLD_WAYS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast([TITAN, WIZARD]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
