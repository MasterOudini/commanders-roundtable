// `Tandem Tactics` — two targets get +1/+2 until cleanup and I gain 2; with
// zero targets I still gain 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TANDEM_TACTICS_SCRIPT } from './tandemTactics';
import { TANDEM_TACTICS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Tandem Tactics';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([TANDEM_TACTICS_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function aimed(): { g: Game; spell: InstanceId; bears: InstanceId; hawk: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, NIGHTHAWK], []],
    scripts: createRegistry([TANDEM_TACTICS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p1', BEARS);
  const hawk = put(g, 'p1', NIGHTHAWK);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, bears, hawk, logAt };
}

describe('Tandem Tactics (up to two targets)', () => {
  test('two targets: both get +1/+2 until cleanup, and 2 life', () => {
    const { g, bears, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: hawk }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 3, toughness: 4 });
    expect(pt(g, hawk)).toEqual({ power: 3, toughness: 5 });
    expect(g.state.players['p1']?.life).toBe(42);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('zero targets: still 2 life, no fizzle', () => {
    const { g, spell, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TANDEM_TACTICS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TANDEM_TACTICS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TANDEM_TACTICS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, bears } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
