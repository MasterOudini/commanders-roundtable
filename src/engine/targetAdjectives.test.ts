// The adjective seam (D294): the adjectives a target clause prints and the
// engine can check are structured restrictions the parser reads, the
// validator enforces on both adapters, and the effect parser may then admit.

import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from '../data/targetParse';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { createRegistry } from './scripts/registry';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears'; // green, no keywords
const HAWK = 'Vampire Nighthawk'; // BLACK
const CATAPULT = 'Grapeshot Catapult'; // an ARTIFACT creature
const FRACTURE = 'Aura Fracture'; // an enchantment spell, {2}{W}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('adjectives are READ (D294)', () => {
  test('a colour, a negated colour, a negated type', () => {
    expect(parseTargetClauses('Destroy target nonblack creature.')[0]?.restrict).toEqual({ colorsNone: ['B'] });
    expect(parseTargetClauses('Destroy target black creature.')[0]?.restrict).toEqual({ colorsAny: ['B'] });
    expect(parseTargetClauses('Destroy target nonartifact creature.')[0]?.restrict).toEqual({ typesNone: ['Artifact'] });
    expect(parseTargetClauses('Exile target nonland permanent.')[0]?.restrict).toEqual({ typesNone: ['Land'] });
  });

  test('supertypes, tapped, token, colour counts', () => {
    expect(parseTargetClauses('Destroy target legendary creature.')[0]?.restrict).toEqual({ supertypesAny: ['Legendary'] });
    expect(parseTargetClauses('Destroy target nonbasic land.')[0]?.restrict).toEqual({ supertypesNone: ['Basic'] });
    expect(parseTargetClauses('Destroy target tapped creature.')[0]?.restrict).toEqual({ tapped: true });
    expect(parseTargetClauses('Exile target nontoken creature.')[0]?.restrict).toEqual({ token: false });
    expect(parseTargetClauses('Destroy target multicolored creature.')[0]?.restrict).toEqual({ colorCount: 'many' });
  });

  test('"noncreature spell" is a spell that is not a creature, with nothing unenforced', () => {
    const [spec] = parseTargetClauses('Counter target noncreature spell.');
    expect(spec?.kinds).toEqual(['spell']);
    expect(spec?.restrict).toEqual({ typesNone: ['Creature'] });
    expect(spec?.unenforced).toEqual([]);
  });

  test('an adjective the engine cannot check stays unenforced', () => {
    const [spec] = parseTargetClauses('Destroy target modified creature.');
    expect(spec?.restrict).toBeNull();
    expect(spec?.unenforced).toEqual(['modified']);
  });

  test('the clause text still quotes the card', () => {
    expect(parseTargetClauses('Destroy target nonblack creature.')[0]?.text).toBe('target nonblack creature');
  });

  test('the effect parser admits the enforced adjectives and refuses the rest', () => {
    expect(parseEffects('Destroy target nonblack creature.', 'Doom Blade', true).mode).toBe('auto');
    expect(parseEffects('Counter target noncreature spell.', 'Negate', true).mode).toBe('auto');
    expect(parseEffects('Exile target nonland permanent.', 'Utter End', true).mode).toBe('auto');
    expect(parseEffects('Destroy target modified creature.', 'x', true).mode).not.toBe('auto');
  });
});

function armed(spell: string, mana: readonly (readonly ['W' | 'U' | 'B' | 'G' | 'C', number])[]): { g: Game; bears: InstanceId; hawk: InstanceId; catapult: InstanceId; island: InstanceId } {
  const g = startedGame({ players: 2, decks: [[spell], [BEARS, HAWK, CATAPULT, 'Island']], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS);
  const hawk = put(g, 'p2', HAWK);
  const catapult = put(g, 'p2', CATAPULT);
  const island = put(g, 'p2', 'Island');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const card = put(g, 'p1', spell, 'hand');
  for (const [sym, n] of mana) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears, hawk, catapult, island };
}

describe('adjectives are ENFORCED and the spells run from the oracle alone (D294)', () => {
  test('Doom Blade refuses the black Nighthawk and destroys the green Bears', () => {
    const { g, bears, hawk } = armed('Doom Blade', [['B', 1], ['C', 1]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('Go for the Throat refuses the artifact creature and destroys the Bears', () => {
    const { g, bears, catapult } = armed('Go for the Throat', [['B', 1], ['C', 1]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: catapult }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('Utter End refuses a land and exiles a creature', () => {
    const { g, bears, island } = armed('Utter End', [['W', 1], ['B', 1], ['C', 2]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: island }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
  });

  test('Disperse refuses a land and returns a creature to its owner’s hand', () => {
    const { g, bears, island } = armed('Disperse', [['U', 1], ['C', 1]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: island }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'hand', player: 'p2' });
  });
});

/** p2 mid-cast of `name` (held on the stack); p1 answers with Negate. */
function heldForNegate(name: string, mana: { symbol: 'G' | 'W'; colorless: number }): { g: Game; theirs: InstanceId; stackId: string } {
  const g = startedGame({ players: 2, decks: [['Negate'], [name]], scripts: createRegistry([]) });
  holdEverywhere(g);
  const theirs = put(g, 'p2', name, 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 2 && s.turn.activePlayer === 'p2' && s.priority.player === 'p2' && s.priority.awaiting === null && (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: mana.symbol, amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: mana.colorless }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: theirs }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const stackId = g.state.stack[0]?.id as string;
  const spell = put(g, 'p1', 'Negate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, theirs, stackId };
}

describe('Negate from the oracle alone (D294)', () => {
  test('counters a held enchantment spell', () => {
    const { g, theirs, stackId } = heldForNegate(FRACTURE, { symbol: 'W', colorless: 2 });
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('refuses a held creature spell', () => {
    const { g, stackId } = heldForNegate(BEARS, { symbol: 'G', colorless: 1 });
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }).ok).toBe(false);
  });
});
