// `Into the Void` — two of the opponent's creatures return to their hand;
// zero targets resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INTO_THE_VOID_SCRIPT } from './intoTheVoid';
import { INTO_THE_VOID } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Into the Void';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; spell: InstanceId; a: InstanceId; b: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS, NIGHTHAWK]],
    scripts: createRegistry([INTO_THE_VOID_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const a = put(g, 'p2', BEARS);
  const b = put(g, 'p2', NIGHTHAWK);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, a, b, logAt };
}

describe('Into the Void (up to two targets)', () => {
  test('two targets: both return to their owner\'s hand', () => {
    const { g, a, b } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }] }));
    settle(g);
    expect(g.state.cards[a]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[b]?.zone).toEqual({ kind: 'hand', player: 'p2' });
  });

  test('one target: the other stays', () => {
    const { g, a, b } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind).toBe('hand');
    expect(g.state.cards[b]?.zone.kind).toBe('battlefield');
  });

  test('zero targets: resolves without fizzling', () => {
    const { g, spell, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INTO_THE_VOID.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INTO_THE_VOID.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INTO_THE_VOID.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, a, b } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
