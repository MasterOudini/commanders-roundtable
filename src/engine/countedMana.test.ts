// D627 - THE COUNTED MANA AMOUNT AND THE FILTER LAND. `{T}: Add {G} for each creature you control.` and its kin carry a
// count (D418's count-noun reader, the source's power) multiplied where the sources are listed; a filter land's hybrid
// `{W/U}` is a mana piece the tap charges, paid by any combination the pool covers. What is proven: the parse (the count on
// the production, the any-colour amount, the filter's charged hybrid and three outputs); the Cradle making one green per
// creature and nothing with none; the Ritualist's X off the graveyard; the filter land paid with blue alone; the cards
// complete; the replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { manaSourcesOf } from './mana';
import { advanceUntil, clearSickness, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { faceOf } from './oracle';
import { isEngineComplete } from '../data/engineComplete';
import type { CardData } from '../data/cardTypes';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const CRADLE = "Gaea's Cradle";
const COFFERS = 'Cabal Coffers';
const GATE = 'Mystic Gate';
const RITUALIST = 'Deathbloom Ritualist';
const PRIEST = 'Priest of Titania';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const prods = (name: string) => {
  const c = ORACLE.byName(name);
  if (!c) throw new Error(name + ' is not in the fixtures');
  return faceOf(c, 0).producesMana;
};
const outputsOf = (g: Game, id: InstanceId) => manaSourcesOf(g.state, g.deps.oracle, g.deps.scripts, 'p1', { includeConditional: true, includeCostly: true }).filter((s) => s.card === id).flatMap((s) => s.outputs.map((o) => Object.entries(o.mana).filter(([, n]) => n > 0).map(([k, n]) => k.repeat(n)).join('')));

function table(): Game {
  const g = startedGame({ players: 2, decks: [[CRADLE, COFFERS, GATE, RITUALIST, PRIEST, 'Grizzly Bears', 'Grizzly Bears', 'Swamp', 'Swamp', 'Llanowar Elves'], ['Grizzly Bears']], scripts: createRegistry([]) });
  holdEverywhere(g);
  main(g, 3);
  return g;
}

describe('D627 - the counted mana amount and the filter land', () => {
  test('the parse: the count rides the production; the any-colour X; the filter land charged and three outputs', () => {
    expect(prods(CRADLE).map((p) => [p.conditional, p.count?.kind ?? null])).toEqual([[false, 'permanents']]);
    expect(prods(COFFERS).map((p) => [p.conditional, p.count?.kind ?? null, p.extraCost?.mana?.raw ?? null])).toEqual([[false, 'permanents', '{2}']]);
    expect(prods(RITUALIST).map((p) => [p.conditional, p.count?.kind ?? null, p.anyColor?.amount ?? null])).toEqual([[false, 'cardsInGraveyard', 1]]);
    expect(prods(PRIEST).map((p) => [p.conditional, p.count?.kind ?? null])).toEqual([[false, 'permanents']]);
    const filter = prods(GATE).find((p) => p.extraCost !== null && p.extraCost !== undefined);
    expect(filter?.conditional).toBe(false);
    expect(filter?.outputs.length).toBe(3);
  });

  test("the Cradle: one green for each creature you control, and no source with none; the tap makes the count", () => {
    const g = table();
    const cradle = put(g, 'p1', CRADLE);
    settle(g);
    expect(outputsOf(g, cradle), 'no creature: no source').toEqual([]);
    put(g, 'p1', 'Grizzly Bears');
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(outputsOf(g, cradle)).toEqual(['GG']);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: cradle, abilityIndex: prods(CRADLE)[0]?.abilityIndex ?? 0, outputChoice: 0 }));
    expect(g.state.players['p1']?.pool.G).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the Priest counts every Elf on the battlefield, itself included; the Ritualist reads the graveyard', () => {
    const g = table();
    const priest = put(g, 'p1', PRIEST);
    settle(g);
    clearSickness(g);
    expect(outputsOf(g, priest)).toEqual(['G']);
    put(g, 'p1', 'Llanowar Elves');
    settle(g);
    expect(outputsOf(g, priest)).toEqual(['GG']);
    const ritualist = put(g, 'p1', RITUALIST);
    settle(g);
    clearSickness(g);
    expect(outputsOf(g, ritualist), 'no creature card in the graveyard').toEqual([]);
    put(g, 'p1', 'Grizzly Bears', 'graveyard');
    settle(g);
    expect(outputsOf(g, ritualist).every((o) => o.length === 1), 'one mana of any one color').toBe(true);
  });

  test('the filter land: its {W/U} paid with blue alone, the chosen pair made', () => {
    const g = table();
    const gate = put(g, 'p1', GATE);
    settle(g);
    const filter = prods(GATE).find((p) => p.extraCost !== null && p.extraCost !== undefined);
    if (!filter) throw new Error('no filter line');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'TapForMana', player: 'p1', card: gate, abilityIndex: filter.abilityIndex, outputChoice: 0 }));
    expect(g.state.players['p1']?.pool.U, 'the {W/U} paid with the blue').toBe(0);
    expect(g.state.players['p1']?.pool.W, 'the first pair made').toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the counted and the filter cards run completely', () => {
    for (const name of [CRADLE, COFFERS, GATE, RITUALIST, PRIEST]) expect(isEngineComplete(ORACLE.byName(name)?.data as CardData), name).toBe(true);
  });
});
