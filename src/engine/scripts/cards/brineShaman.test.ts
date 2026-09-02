// `Brine Shaman` — a creature buys +2/+2 on the tap; three mana and a
// creature counter a held CREATURE spell, and an enchantment spell is
// refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRINE_SHAMAN_SCRIPT } from './brineShaman';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SHAMAN = 'Brine Shaman';
const BEARS = 'Grizzly Bears';
const FRACTURE = 'Aura Fracture'; // an enchantment, {2}{W}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; shaman: InstanceId; target: InstanceId; fodder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SHAMAN, BEARS, BEARS], []],
    scripts: createRegistry([BRINE_SHAMAN_SCRIPT]),
  });
  const target = put(g, 'p1', BEARS);
  const fodder = put(g, 'p1', BEARS);
  const shaman = put(g, 'p1', SHAMAN);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, shaman, target, fodder };
}

/** p2 mid-cast of `name`, the spell HELD on the stack, p1 to respond with mana and fodder up. */
function held(name: string, mana: { symbol: 'G' | 'W'; colorless: number }): { g: Game; shaman: InstanceId; fodder: InstanceId; spell: InstanceId; stackId: string } {
  const g = startedGame({
    players: 2,
    decks: [[SHAMAN, BEARS], [BEARS, FRACTURE]],
    scripts: createRegistry([BRINE_SHAMAN_SCRIPT]),
  });
  holdEverywhere(g);
  const shaman = put(g, 'p1', SHAMAN);
  const fodder = put(g, 'p1', BEARS);
  const spell = put(g, 'p2', name, 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 2 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: mana.symbol, amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: mana.colorless }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const stackId = g.state.stack[0]?.id as string;
  return { g, shaman, fodder, spell, stackId };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([BRINE_SHAMAN_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Brine Shaman', () => {
  test('{T}, sacrifice a creature: +2/+2', () => {
    const { g, shaman, target, fodder } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: shaman, abilityIndex: 0, sacrifice: fodder }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(pt(g, target)).toEqual({ power: 4, toughness: 4 });
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[shaman]?.tapped).toBe(true);
  });

  test('{1}{U}{U}, sacrifice a creature: the held creature spell is countered', () => {
    const { g, shaman, fodder, spell, stackId } = held(BEARS, { symbol: 'G', colorless: 1 });
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: shaman, abilityIndex: 1, sacrifice: fodder }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('an enchantment spell is refused at the aim ("creature spell")', () => {
    const { g, shaman, fodder, stackId } = held(FRACTURE, { symbol: 'W', colorless: 2 });
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: shaman, abilityIndex: 1, sacrifice: fodder }));
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, shaman, fodder, stackId } = held(BEARS, { symbol: 'G', colorless: 1 });
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: shaman, abilityIndex: 1, sacrifice: fodder }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
