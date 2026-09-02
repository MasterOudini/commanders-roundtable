// `Dual Shot` — 1 damage marked on each of two creatures; a 1-toughness
// target dies to it; zero targets resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DUAL_SHOT_SCRIPT } from './dualShot';
import { DUAL_SHOT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Dual Shot';
const BEARS = 'Grizzly Bears';
const CHILD = 'Child of Night';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; spell: InstanceId; bears: InstanceId; child: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS, CHILD]],
    scripts: createRegistry([DUAL_SHOT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS);
  const child = put(g, 'p2', CHILD);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, bears, child, logAt };
}

describe('Dual Shot (up to two targets)', () => {
  test('two targets: the bear is marked 1, the 2/1 Child dies', () => {
    const { g, bears, child } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: child }] }));
    settle(g);
    expect(g.state.cards[bears]?.damage).toBe(1);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[child]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
  });

  test('zero targets: resolves without fizzling', () => {
    const { g, spell, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DUAL_SHOT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DUAL_SHOT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DUAL_SHOT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, bears, child } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: child }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
