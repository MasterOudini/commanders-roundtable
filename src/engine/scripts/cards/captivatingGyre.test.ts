// `Captivating Gyre` — three creatures (theirs and mine) return to their
// owners' hands; zero targets resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CAPTIVATING_GYRE_SCRIPT } from './captivatingGyre';
import { CAPTIVATING_GYRE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Captivating Gyre';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; spell: InstanceId; mine: InstanceId; a: InstanceId; b: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [BEARS, NIGHTHAWK]],
    scripts: createRegistry([CAPTIVATING_GYRE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const mine = put(g, 'p1', BEARS);
  const a = put(g, 'p2', BEARS);
  const b = put(g, 'p2', NIGHTHAWK);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, mine, a, b, logAt };
}

describe('Captivating Gyre (up to three targets)', () => {
  test('three targets, mine included: each to its owner\'s hand', () => {
    const { g, mine, a, b } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }, { kind: 'card', id: a }, { kind: 'card', id: b }] }));
    settle(g);
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[a]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[b]?.zone).toEqual({ kind: 'hand', player: 'p2' });
  });

  test('zero targets: resolves without fizzling', () => {
    const { g, spell, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CAPTIVATING_GYRE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CAPTIVATING_GYRE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CAPTIVATING_GYRE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, a, b } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
