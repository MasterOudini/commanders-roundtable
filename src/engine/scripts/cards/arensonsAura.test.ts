// `Arenson's Aura` — an enchantment paid to destroy an enchantment (a
// creature is not a legal target); five mana to counter an ENCHANTMENT
// spell held on the stack, and a creature spell is refused at the aim.
//
// ⚠️ The counter's refusal case IS the probe for "target enchantment spell":
// if the aim layer ever accepts the Bears here, the qualifier is silently
// widened and this card must be refused (D208's rule), not shipped.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARENSONS_AURA_SCRIPT } from './arensonsAura';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const AURA = "Arenson's Aura";
const FRACTURE = 'Aura Fracture'; // an enchantment, {2}{W}
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; aura: InstanceId; mine: InstanceId; theirs: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[AURA, FRACTURE], [FRACTURE, BEARS]],
    scripts: createRegistry([ARENSONS_AURA_SCRIPT]),
  });
  const aura = put(g, 'p1', AURA);
  const mine = put(g, 'p1', FRACTURE);
  const theirs = put(g, 'p2', FRACTURE);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  return { g, aura, mine, theirs, bears };
}

/** p2 mid-cast of `name`, the spell HELD on the stack, p1 to respond with five mana up. */
function held(name: string, mana: { symbol: 'W' | 'G'; colorless: number }): { g: Game; aura: InstanceId; spell: InstanceId; stackId: string } {
  const g = startedGame({
    players: 2,
    decks: [[AURA], [FRACTURE, BEARS]],
    scripts: createRegistry([ARENSONS_AURA_SCRIPT]),
  });
  holdEverywhere(g);
  const aura = put(g, 'p1', AURA);
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
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  const stackId = g.state.stack[0]?.id as string;
  return { g, aura, spell, stackId };
}

describe("Arenson's Aura", () => {
  test('{W}, sacrifice an enchantment: the target enchantment is destroyed', () => {
    const { g, aura, mine, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: aura, abilityIndex: 0, sacrifice: mine }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[aura]?.zone.kind).toBe('battlefield');
  });

  test('a creature is not a legal target for the destroy', () => {
    const { g, aura, mine, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: aura, abilityIndex: 0, sacrifice: mine }));
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    expect(res.ok).toBe(false);
  });

  test('{3}{U}{U}: the held enchantment spell is countered', () => {
    const { g, aura, spell, stackId } = held(FRACTURE, { symbol: 'W', colorless: 2 });
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: aura, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('a creature spell is refused at the aim ("enchantment spell")', () => {
    const { g, aura, stackId } = held(BEARS, { symbol: 'G', colorless: 1 });
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: aura, abilityIndex: 1 }));
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, aura, stackId } = held(FRACTURE, { symbol: 'W', colorless: 2 });
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: aura, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
