// `Join Forces` — my two attacking bears untap and each get +2/+2
// mid-combat; zero targets resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { JOIN_FORCES_SCRIPT } from './joinForces';
import { JOIN_FORCES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Join Forces';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([JOIN_FORCES_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function midCombat(): { g: Game; spell: InstanceId; a: InstanceId; b: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, BEARS], []],
    scripts: createRegistry([JOIN_FORCES_SCRIPT]),
  });
  const a = put(g, 'p1', BEARS);
  const b = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.priority.awaiting?.kind === 'declareAttackers', 120_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: a, defender: { kind: 'player', id: 'p2' } }, { card: b, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, a, b, logAt };
}

describe('Join Forces (up to two targets)', () => {
  test('two attackers: both untap and get +2/+2; the attack lands for 8', () => {
    const { g, a, b } = midCombat();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }] }));
    settle(g);
    expect(g.state.cards[a]?.tapped).toBe(false);
    expect(g.state.cards[b]?.tapped).toBe(false);
    expect(pt(g, b)).toEqual({ power: 4, toughness: 4 });
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    expect(g.state.players['p2']?.life).toBe(32);
  });

  test('zero targets: resolves without fizzling', () => {
    const { g, spell, a, logAt } = midCombat();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[a]?.tapped).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = JOIN_FORCES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, JOIN_FORCES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(JOIN_FORCES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, a } = midCombat();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
