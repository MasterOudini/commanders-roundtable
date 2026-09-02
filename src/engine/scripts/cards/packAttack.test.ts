// `Pack Attack` — with one player attacked X is 1: the attacker swings for
// 3 and I draw; with nobody attacking, only the card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PACK_ATTACK_SCRIPT } from './packAttack';
import { PACK_ATTACK } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Pack Attack';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], []],
    scripts: createRegistry([PACK_ATTACK_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  return { g, bears };
}

function castIt(g: Game): number {
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const before = idsIn(g, 'p1', 'hand').length - 1;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return before;
}

function power(g: Game, id: InstanceId): number | null {
  const d = deps(createRegistry([PACK_ATTACK_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).power;
}

describe('Pack Attack', () => {
  test('one player attacked: +1/+0 and a card', () => {
    const { g, bears } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 60_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const before = castIt(g);
    expect(power(g, bears)).toBe(3);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('nobody attacking: X is 0, only the card', () => {
    const { g, bears } = board();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const before = castIt(g);
    expect(power(g, bears)).toBe(2);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PACK_ATTACK.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PACK_ATTACK.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PACK_ATTACK.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    castIt(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
