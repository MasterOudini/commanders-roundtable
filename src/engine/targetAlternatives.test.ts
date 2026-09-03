// D297 - PER-ALTERNATIVE target specs. A printed list whose alternatives differ
// ("artifact, enchantment, or creature with flying", "creature or Vehicle",
// "artifact creature or black creature") is read piece by piece; a candidate is
// admitted when SOME alternative admits it. Proven three ways: the parse, the
// validator over hand-built candidates, and real cards cast from the ORACLE
// with no script.

import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from '../data/targetParse';
import { targetAllowed, type TargetCandidate } from './targets';
import { createRegistry } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SRC = { controller: 'p1', colors: ['G'] } as const;

function cand(over: Partial<TargetCandidate>): TargetCandidate {
  return {
    choice: { kind: 'card', id: 'x' as InstanceId },
    zone: 'battlefield',
    controller: 'p2',
    kinds: ['creature', 'permanent'],
    types: ['Creature'],
    manaValue: 2,
    power: 2,
    toughness: 2,
    colors: ['G'],
    keywords: [],
    combat: { attacking: false, blocking: false },
    supertypes: [],
    subtypes: [],
    tapped: false,
    isToken: false,
    hexproof: false,
    shroud: false,
    protection: { colors: [], fromEverything: false, other: [] },
    ...over,
  };
}

describe('a list whose alternatives differ parses into alternatives (D297)', () => {
  test('the trailing qualifier binds the LAST alternative', () => {
    const spec = parseTargetClauses('Destroy target artifact, enchantment, or creature with flying.')[0];
    expect(spec?.kinds).toEqual(['artifact', 'enchantment', 'creature']);
    expect(spec?.alternatives?.map((a) => a.kinds)).toEqual([['artifact'], ['enchantment'], ['creature']]);
    expect(spec?.alternatives?.[2]?.keyword).toEqual({ word: 'flying', present: true });
    expect(spec?.alternatives?.[0]?.keyword).toBeNull();
    expect(spec?.keyword).toBeNull();
    expect(spec?.unenforced).toEqual([]);
    expect(spec?.text).toBe('target artifact, enchantment, or creature with flying');
  });

  test('a subtype alternative is enforced as its card type plus the subtype', () => {
    const spec = parseTargetClauses("Return target creature or Vehicle to its owner's hand.")[0];
    expect(spec?.kinds).toEqual(['creature', 'artifact']);
    expect(spec?.alternatives?.[1]).toEqual({ kinds: ['artifact'], cardTypes: [], subtypes: ['Vehicle'], restrict: null, keyword: null, numeric: null });
    expect(spec?.unenforced).toEqual([]);
  });

  test('an adjective binds its own piece; "artifact creature" is both types', () => {
    const spec = parseTargetClauses('Destroy target artifact creature or black creature.')[0];
    expect(spec?.alternatives?.[0]).toEqual({ kinds: ['creature'], cardTypes: ['Artifact'], subtypes: [], restrict: null, keyword: null, numeric: null });
    expect(spec?.alternatives?.[1]?.restrict).toEqual({ colorsAny: ['B'] });
    const two = parseTargetClauses('Exile target multicolored creature or multicolored enchantment.')[0];
    expect(two?.alternatives?.map((a) => a.restrict)).toEqual([{ colorCount: 'many' }, { colorCount: 'many' }]);
    const land = parseTargetClauses('Destroy target land or nonblack creature.')[0];
    expect(land?.alternatives?.[1]?.restrict).toEqual({ colorsNone: ['B'] });
  });

  test('a typed-spell alternative and three-piece lists', () => {
    const spell = parseTargetClauses('Counter target creature or Aura spell.')[0];
    expect(spell?.kinds).toEqual(['spell']);
    expect(spell?.alternatives?.map((a) => [a.cardTypes, a.subtypes])).toEqual([[['Creature'], []], [[], ['Aura']]]);
    const three = parseTargetClauses('Destroy target creature, Vehicle, or nonbasic land.')[0];
    expect(three?.alternatives?.length).toBe(3);
    expect(three?.alternatives?.[2]?.restrict).toEqual({ supertypesNone: ['Basic'] });
  });

  test('what the table already says stays as it was; what neither can say is recorded, never dropped', () => {
    const plain = parseTargetClauses('Destroy target artifact or enchantment.')[0];
    expect(plain?.alternatives).toBeNull();
    expect(plain?.kinds).toEqual(['artifact', 'enchantment']);
    // A qualifier inside a non-final piece: the reader cannot place it, so the
    // clause keeps its noun and RECORDS the unread words as unenforced (D138).
    const odd = parseTargetClauses('Destroy target creature with flying or artifact.')[0];
    expect(odd?.kinds).toEqual(['creature']);
    expect(odd?.unenforced).toEqual(['with flying or artifact']);
    const counter = parseTargetClauses('Destroy target creature with a +1/+1 counter on it.')[0];
    expect(counter?.unenforced).toEqual(['with a +1/+1 counter on it']);
  });
});

describe('a single subtype noun and a hyphenated non-Subtype are enforced (D297)', () => {
  test('"target Wall" / "target Equipment" restrict on the subtype and leave nothing unenforced', () => {
    const wall = parseTargetClauses('Destroy target Wall.')[0];
    expect(wall?.kinds).toEqual(['creature']);
    expect(wall?.restrict).toEqual({ subtypesAll: ['Wall'] });
    expect(wall?.unenforced).toEqual([]);
    const eq = parseTargetClauses('Attach target Equipment you control to target creature you control.')[0];
    expect(eq?.restrict).toEqual({ subtypesAll: ['Equipment'] });
    expect(eq?.controller).toBe('you');
  });

  test('"non-Elf creature" is a subtype exclusion; "nonland" is still a type one', () => {
    const elf = parseTargetClauses('Destroy target non-Elf creature.')[0];
    expect(elf?.restrict).toEqual({ subtypesNone: ['Elf'] });
    expect(elf?.unenforced).toEqual([]);
    expect(parseTargetClauses('Exile target nonland permanent.')[0]?.restrict).toEqual({ typesNone: ['Land'] });
  });

  test('the validator checks the subtype both ways', () => {
    const wall = parseTargetClauses('Destroy target Wall.')[0]!;
    expect(targetAllowed(wall, SRC, cand({ subtypes: ['Wall'] }))).toBe(true);
    expect(targetAllowed(wall, SRC, cand({ subtypes: ['Bear'] }))).toBe(false);
    const elf = parseTargetClauses('Destroy target non-Elf creature.')[0]!;
    expect(targetAllowed(elf, SRC, cand({ subtypes: ['Bear'] }))).toBe(true);
    expect(targetAllowed(elf, SRC, cand({ subtypes: ['Elf', 'Warrior'] }))).toBe(false);
  });
});

describe('the validator admits a candidate some alternative admits (D297)', () => {
  const wings = parseTargetClauses('Destroy target artifact, enchantment, or creature with flying.')[0]!;
  const vehicle = parseTargetClauses("Return target creature or Vehicle to its owner's hand.")[0]!;
  const purge = parseTargetClauses('Destroy target artifact creature or black creature.')[0]!;

  test('"creature with flying" admits a flier and refuses a ground creature; the other pieces need no flying', () => {
    expect(targetAllowed(wings, SRC, cand({ keywords: ['flying'] }))).toBe(true);
    expect(targetAllowed(wings, SRC, cand({}))).toBe(false);
    expect(targetAllowed(wings, SRC, cand({ kinds: ['artifact', 'permanent'], types: ['Artifact'], power: null, toughness: null }))).toBe(true);
    expect(targetAllowed(wings, SRC, cand({ kinds: ['enchantment', 'permanent'], types: ['Enchantment'], power: null, toughness: null }))).toBe(true);
    expect(targetAllowed(wings, SRC, cand({ kinds: ['land', 'permanent'], types: ['Land'], power: null, toughness: null }))).toBe(false);
  });

  test('"Vehicle" admits an artifact WITH the subtype and refuses a plain artifact', () => {
    expect(targetAllowed(vehicle, SRC, cand({ kinds: ['artifact', 'permanent'], types: ['Artifact'], subtypes: ['Vehicle'], power: null, toughness: null }))).toBe(true);
    expect(targetAllowed(vehicle, SRC, cand({ kinds: ['artifact', 'permanent'], types: ['Artifact'], power: null, toughness: null }))).toBe(false);
    expect(targetAllowed(vehicle, SRC, cand({}))).toBe(true);
  });

  test('"artifact creature or black creature": both types, or the colour', () => {
    expect(targetAllowed(purge, SRC, cand({ types: ['Artifact', 'Creature'], colors: [] }))).toBe(true);
    expect(targetAllowed(purge, SRC, cand({ colors: ['B'] }))).toBe(true);
    expect(targetAllowed(purge, SRC, cand({}))).toBe(false);
    expect(targetAllowed(purge, SRC, cand({ kinds: ['artifact', 'permanent'], types: ['Artifact'], colors: [], power: null, toughness: null }))).toBe(false);
  });
});

const BEARS = 'Grizzly Bears';
const HAWK = 'Vampire Nighthawk';
const RING = 'Sol Ring';
const DREADNOUGHT = 'Consulate Dreadnought'; // an artifact — Vehicle
const WALL = 'Wall of Omens'; // a creature — Wall

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(spell: string, mana: readonly (readonly ['W' | 'U' | 'B' | 'R' | 'G' | 'C', number])[]): { g: Game; bears: InstanceId; hawk: InstanceId; ring: InstanceId; vehicle: InstanceId; wall: InstanceId } {
  const g = startedGame({ players: 2, decks: [[spell], [BEARS, HAWK, RING, DREADNOUGHT, WALL]], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS);
  const hawk = put(g, 'p2', HAWK);
  const ring = put(g, 'p2', RING);
  const vehicle = put(g, 'p2', DREADNOUGHT);
  const wall = put(g, 'p2', WALL);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const card = put(g, 'p1', spell, 'hand');
  for (const [sym, n] of mana) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears, hawk, ring, vehicle, wall };
}

describe('the cards run from the oracle alone (D297)', () => {
  test('Broken Wings refuses the ground Bears, destroys the flying Nighthawk', () => {
    const { g, bears, hawk } = armed('Broken Wings', [['G', 1], ['C', 2]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[hawk]?.zone.kind).toBe('graveyard');
  });

  test('Broken Wings destroys an artifact, which needs no flying', () => {
    const { g, ring } = armed('Broken Wings', [['G', 1], ['C', 2]]);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
  });

  test('Bounce Off refuses a plain artifact and bounces the Vehicle', () => {
    const { g, ring, vehicle } = armed('Bounce Off', [['U', 1], ['C', 1]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vehicle }] }));
    settle(g);
    expect(g.state.cards[vehicle]?.zone.kind).toBe('hand');
  });

  test('Tunnel refuses the Bears and destroys the Wall (a subtype noun, enforced)', () => {
    const { g, bears, wall } = armed('Tunnel', [['R', 1]]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wall }] }));
    settle(g);
    expect(g.state.cards[wall]?.zone.kind).toBe('graveyard');
  });
});
