// `Lead Astray` — two of the opponent's creatures are tapped; zero targets
// resolves; three are refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LEAD_ASTRAY_SCRIPT } from './leadAstray';
import { LEAD_ASTRAY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Lead Astray';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';
const CHILD = 'Child of Night';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; spell: InstanceId; a: InstanceId; b: InstanceId; c: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS, NIGHTHAWK, CHILD]],
    scripts: createRegistry([LEAD_ASTRAY_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const a = put(g, 'p2', BEARS);
  const b = put(g, 'p2', NIGHTHAWK);
  const c = put(g, 'p2', CHILD);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, a, b, c, logAt };
}

describe('Lead Astray (up to two targets)', () => {
  test('two targets: both tapped, the third not', () => {
    const { g, a, b, c } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }] }));
    settle(g);
    expect(g.state.cards[a]?.tapped).toBe(true);
    expect(g.state.cards[b]?.tapped).toBe(true);
    expect(g.state.cards[c]?.tapped).toBe(false);
  });

  test('zero targets: resolves without fizzling', () => {
    const { g, spell, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test('three targets are refused', () => {
    const { g, a, b, c } = aimed();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }, { kind: 'card', id: c }] });
    expect(res.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LEAD_ASTRAY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LEAD_ASTRAY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LEAD_ASTRAY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, a, b } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
