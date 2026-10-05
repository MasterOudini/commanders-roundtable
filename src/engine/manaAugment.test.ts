// D634 - THE TRIGGERED MANA ABILITIES AND THE DOUBLERS. A mana ability's triggered mana abilities resolve at once (CR 605.1b,
// 605.4a) and a doubler replaces what a tap makes (CR 106.12), so what the tap ALSO makes is folded into the tapped source's
// outputs (`augmentOutputs`, off `OracleFace.manaAugment`): the offer, the tap and the solver read one list. What is proven: the
// parse (an Aura's extra on its land, a player's and your land, a land type, the doublers); Wild Growth's Forest makes {G}{G} and
// its tap adds it, marked; Fertile Ground's Forest offers a colour of choice beside its {G}; Mana Flare doubles every player's
// land; Crypt Ghast its controller's Swamps alone; Mana Reflection doubles a Sol Ring; the cards complete; the replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { faceOf } from './oracle';
import { manaSourcesOf } from './mana';
import { engineCompleteness } from '../data/engineComplete';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';

const CARDS = ['Wild Growth', 'Overgrowth', 'Fertile Ground', 'Mana Flare', 'Heartbeat of Spring', 'Dictate of Karametra', 'Zhur-Taa Ancient', 'Crypt Ghast', 'Vernal Bloom', 'Mana Reflection', 'Nyxbloom Ancient', 'Market Festival', "Dawn's Reflection"];
const FILLER = Array.from({ length: 12 }, () => 'Plains');

const card = (name: string) => {
  const c = deps().oracle.byName(name);
  if (!c) throw new Error('no such fixture: ' + name);
  return c;
};
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
/** Every output a source offers, spelled as its symbols (`GG`, `GW`), sorted. */
const offers = (g: Game, who: PlayerId, id: InstanceId) =>
  manaSourcesOf(g.state, g.deps.oracle, g.deps.scripts, who, { includeConditional: true })
    .filter((s) => s.card === id)
    .flatMap((s) => s.outputs.map((o) => Object.entries(o.mana).flatMap(([k, n]) => Array.from({ length: n }, () => k)).sort().join('')))
    .sort();

function table(mine: readonly string[], theirs: readonly string[]): { g: Game; p1: InstanceId[]; p2: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[...mine, 'Wild Growth', 'Fertile Ground', ...FILLER], [...theirs, ...FILLER]], options: { maxHandSize: null } });
  holdEverywhere(g);
  const p1 = mine.map((n) => put(g, 'p1', n));
  const p2 = theirs.map((n) => put(g, 'p2', n));
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
  return { g, p1, p2 };
}
/** The Aura cast from hand onto the land (its cost from the manual mana tool), resolved. */
function enchant(g: Game, aura: string, land: InstanceId, cost: string): void {
  const spell = put(g, 'p1', aura, 'hand');
  for (const s of cost) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: land }] }));
  settle(g);
  expect(g.state.cards[spell]?.attachedTo, aura + ' enchants the land').toBe(land);
}

describe('D634 - the parse', () => {
  test('an Aura on its land, a player or you tapping a land, a land type, the doublers', () => {
    expect(faceOf(card('Wild Growth'), 0).manaAugment).toEqual([{ kind: 'enchantedLand', line: 1, extra: { kind: 'fixed', mana: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 } } }]);
    const fertile = faceOf(card('Fertile Ground'), 0).manaAugment?.[0];
    expect(fertile && 'extra' in fertile ? fertile.extra : null).toEqual({ kind: 'anyColor', amount: 1 });
    expect(faceOf(card('Mana Flare'), 0).manaAugment).toEqual([{ kind: 'landsTapped', line: 0, extra: { kind: 'sameType' }, who: 'any' }]);
    const ghast = faceOf(card('Crypt Ghast'), 0).manaAugment?.[0];
    expect([ghast?.kind, ghast && 'who' in ghast ? ghast.who : null, ghast && 'subtype' in ghast ? ghast.subtype : null]).toEqual(['landsTapped', 'you', 'Swamp']);
    const bloom = faceOf(card('Vernal Bloom'), 0).manaAugment?.[0];
    expect([bloom?.kind, bloom && 'who' in bloom ? bloom.who : null, bloom && 'subtype' in bloom ? bloom.subtype : null]).toEqual(['landsTapped', 'any', 'Forest']);
    expect(faceOf(card('Mana Reflection'), 0).manaAugment).toEqual([{ kind: 'multiplier', line: 0, factor: 2 }]);
    expect(faceOf(card('Nyxbloom Ancient'), 0).manaAugment?.find((a) => a.kind === 'multiplier')).toEqual({ kind: 'multiplier', line: 1, factor: 3 });
    expect(faceOf(card('Grizzly Bears'), 0).manaAugment).toBeUndefined();
  });

  test('the cards complete', () => {
    for (const name of CARDS) expect(engineCompleteness(card(name).data), name).toEqual({ complete: true, leftover: [] });
  });
});

describe('D634 - the sources', () => {
  test('Wild Growth: its Forest makes {G}{G}; the tap adds it, marked', () => {
    const { g, p1 } = table(['Forest', 'Forest'], []);
    const [forest, other] = p1 as [InstanceId, InstanceId];
    enchant(g, 'Wild Growth', forest, 'G');
    expect(offers(g, 'p1', forest)).toEqual(['GG']);
    expect(offers(g, 'p1', other), 'the other Forest is not enchanted').toEqual(['G']);
    const src = manaSourcesOf(g.state, g.deps.oracle, g.deps.scripts, 'p1', { includeConditional: true }).find((s) => s.card === forest);
    if (!src) throw new Error('no source');
    must(g.submit({ t: 'TapForMana', player: 'p1', card: forest, abilityIndex: src.abilityIndex, outputChoice: 0 }));
    expect(g.state.players.p1?.pool.G).toBe(2);
    expect(g.log.some((e) => e.body.t === 'ManaAdded' && e.body.source === forest && e.body.augmented === true)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Fertile Ground: a colour of choice beside the Forest’s {G}', () => {
    const { g, p1 } = table(['Forest'], []);
    const forest = p1[0] as InstanceId;
    enchant(g, 'Fertile Ground', forest, 'GC');
    expect(offers(g, 'p1', forest)).toEqual(['BG', 'GG', 'GR', 'GU', 'GW']);
  });

  test("Mana Flare: every player's land; Crypt Ghast: its controller's Swamps alone; Mana Reflection: a Sol Ring", () => {
    const { g, p1, p2 } = table(['Mana Flare', 'Forest', 'Crypt Ghast', 'Swamp'], ['Island', 'Swamp']);
    const [, forest, , swamp] = p1 as [InstanceId, InstanceId, InstanceId, InstanceId];
    const [island, theirSwamp] = p2 as [InstanceId, InstanceId];
    expect(offers(g, 'p1', forest)).toEqual(['GG']);
    expect(offers(g, 'p1', swamp), 'Mana Flare and Crypt Ghast both').toEqual(['BBB']);
    expect(offers(g, 'p2', island)).toEqual(['UU']);
    expect(offers(g, 'p2', theirSwamp), 'Mana Flare alone - the Ghast is not theirs').toEqual(['BB']);
    const r = table(['Mana Reflection', 'Sol Ring'], []);
    expect(offers(r.g, 'p1', r.p1[1] as InstanceId)).toEqual(['CCCC']);
  });
});
