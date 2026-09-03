// D295 - four sentences the effect parser reads now: "You lose N life.", "Its
// controller loses N life.", "Its controller draws a card.", and "It/They can't
// be regenerated." (a no-op: nothing regenerates in this engine). Each is
// proven twice: the parse, and a real card cast from the ORACLE with no script.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { parseTargetClauses } from '../data/targetParse';
import { createRegistry } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kinds(text: string, name = 'X'): string[] {
  return parseEffects(text, name, true).effects.map((e) => e.kind);
}

describe('the four sentences parse (D295)', () => {
  test('"You lose N life." is a self loseLife', () => {
    const r = parseEffects('Exile target nonland permanent. You lose 3 life.', 'Anguished Unmaking', true);
    expect(r.effects.map((e) => e.kind)).toEqual(['exile', 'loseLife']);
    expect(r.effects[1]?.self).toBe(true);
    expect(r.effects[1]?.amount).toBe(3);
  });

  test('"Its controller loses N life." addresses the first target\'s controller', () => {
    expect(kinds('Destroy target nonblack creature. Its controller loses 2 life.')).toEqual(['destroy', 'controllerLosesLife']);
    expect(kinds('Counter target noncreature spell. Its controller loses 2 life.')).toEqual(['counter', 'controllerLosesLife']);
  });

  test('"Its controller draws a card." likewise', () => {
    expect(kinds('Exile target nonland permanent. Its controller draws a card.')).toEqual(['exile', 'controllerDraws']);
  });

  test('"It can\'t be regenerated." is a claimed no-op, singular and plural', () => {
    expect(kinds("Destroy target nonblack creature. It can't be regenerated.")).toEqual(['destroy', 'noop']);
    expect(kinds("Destroy target nonblack creature and target land. They can't be regenerated.")).toContain('noop');
  });

  test('a sentence about regeneration that DOES something is still refused', () => {
    expect(kinds('Regenerate target creature.')).not.toContain('noop');
  });
});

describe('the combat-role suffix is read (D295)', () => {
  test('"creature that\'s attacking or blocking" carries the role like the adjective form', () => {
    const spec = parseTargetClauses("Exile target white creature that's attacking or blocking.")[0];
    expect(spec?.kinds).toEqual(['creature']);
    expect(spec?.combatRole).toBe('attackingOrBlocking');
    expect(spec?.restrict).toEqual({ colorsAny: ['W'] });
    expect(parseTargetClauses("Destroy target creature that's attacking.")[0]?.combatRole).toBe('attacking');
    expect(parseTargetClauses('Destroy target creature that is blocking.')[0]?.combatRole).toBe('blocking');
    expect(parseTargetClauses('Destroy target creature.')[0]?.combatRole).toBeNull();
  });
});

function armed(spell: string, mana: readonly (readonly ['W' | 'U' | 'B' | 'G' | 'C', number])[]): { g: Game; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[spell], [BEARS]], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const card = put(g, 'p1', spell, 'hand');
  for (const [sym, n] of mana) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears };
}

describe('the cards run from the oracle alone (D295)', () => {
  test('Anguished Unmaking exiles the Bears and its caster loses 3 life', () => {
    const { g, bears } = armed('Anguished Unmaking', [['W', 1], ['B', 1], ['C', 1]]);
    const life0 = { p1: g.state.players.p1?.life ?? 0, p2: g.state.players.p2?.life ?? 0 };
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect(g.state.players.p1?.life).toBe(life0.p1 - 3);
    expect(g.state.players.p2?.life).toBe(life0.p2);
  });

  test("Hideous End destroys the Bears and ITS controller loses 2 life", () => {
    const { g, bears } = armed('Hideous End', [['B', 2], ['C', 1]]);
    const life0 = { p1: g.state.players.p1?.life ?? 0, p2: g.state.players.p2?.life ?? 0 };
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p2?.life).toBe(life0.p2 - 2);
    expect(g.state.players.p1?.life).toBe(life0.p1);
  });

  test('Introduction to Annihilation exiles the Bears and its controller draws', () => {
    const { g, bears } = armed('Introduction to Annihilation', [['C', 5]]);
    const before = (g.state.zones.hand.p2 ?? []).length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect((g.state.zones.hand.p2 ?? []).length).toBe(before + 1);
  });

  test("Annihilate destroys the Bears, the regeneration sentence does nothing, and the caster draws", () => {
    const { g, bears } = armed('Annihilate', [['B', 2], ['C', 3]]);
    const before = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand.p1 ?? []).length).toBe(before + 1);
  });

  test('Countersquall counters a held noncreature spell and ITS controller loses 2 life', () => {
    const g = startedGame({ players: 2, decks: [['Countersquall'], ['Pyretic Ritual']], scripts: createRegistry([]) });
    holdEverywhere(g);
    const mine = put(g, 'p1', 'Countersquall', 'hand');
    const ritual = put(g, 'p2', 'Pyretic Ritual', 'hand');
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber >= 2 && s.turn.activePlayer === 'p2' && s.priority.player === 'p2' && s.priority.awaiting === null && s.turn.phase === 'precombatMain',
      20_000,
    );
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: ritual }));
    advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const stackId = g.state.stack[0]?.id as string;
    const life0 = { p1: g.state.players.p1?.life ?? 0, p2: g.state.players.p2?.life ?? 0 };
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mine }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[ritual]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p2?.life).toBe(life0.p2 - 2);
    expect(g.state.players.p1?.life).toBe(life0.p1);
  });
});
