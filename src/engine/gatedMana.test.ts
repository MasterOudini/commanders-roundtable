// D626 - THE GATED MANA ABILITY. `{T}: Add {G}. Activate only if you control a Swamp or a Forest.` - the mana line's last
// sentence is an activation restriction the activated abilities' closed reader reads; read whole it is the source's gate.
// What is proven: the parse (the gated line beside the ungated one, an ability word before the cost, the count and the
// power conditions; a gate outside the reader stays conditional); the source offered and tapped only while the gate holds
// (`manaSourcesOf`, the tap refused); the gated cards complete; the replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { manaSourcesOf } from './mana';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { faceOf } from './oracle';
import { isEngineComplete } from '../data/engineComplete';
import type { CardData } from '../data/cardTypes';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const VERGE = 'Wastewood Verge';
const TEMPLE = 'Temple of the False God';
const MOX = 'Mox Opal';
const FANATIC = 'Fanatic of Rhonas';
const LAIR = 'Hidden Lair';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const prods = (name: string) => {
  const c = ORACLE.byName(name);
  if (!c) throw new Error(name + ' is not in the fixtures');
  return faceOf(c, 0).producesMana;
};
const sourcesOf = (g: Game, id: InstanceId) => manaSourcesOf(g.state, g.deps.oracle, g.deps.scripts, 'p1', { includeConditional: true }).filter((s) => s.card === id);
const colours = (g: Game, id: InstanceId) => sourcesOf(g, id).flatMap((s) => s.outputs.map((o) => Object.entries(o.mana).filter(([, n]) => n > 0).map(([k, n]) => k.repeat(n)).join('')));

function table(): Game {
  const g = startedGame({ players: 2, decks: [[VERGE, TEMPLE, MOX, FANATIC, 'Forest', 'Forest', 'Island', 'Island', 'Island', 'Island', 'Sol Ring', 'Ornithopter', 'Memnite'], ['Grizzly Bears']], scripts: createRegistry([]) });
  holdEverywhere(g);
  main(g, 3);
  return g;
}

describe('D626 - the gated mana ability', () => {
  test('the parse: the gate read on the gated line alone; an ability word before the cost is print; counts and power', () => {
    const verge = prods(VERGE);
    expect(verge.map((p) => [p.conditional, p.activationConditions?.length ?? 0])).toEqual([[false, 0], [false, 1]]);
    expect(prods(TEMPLE).map((p) => [p.conditional, p.activationConditions?.[0]?.kind ?? null])).toEqual([[false, 'controlCount']]);
    expect(prods(MOX).map((p) => [p.conditional, p.requiresTap, p.extraCost ?? null, p.activationConditions?.[0]?.kind ?? null])).toEqual([[false, true, null, 'controlCount']]);
    expect(prods(FANATIC).every((p) => !p.conditional), 'its plain {G} and its ferocious line').toBe(true);
    expect(prods(FANATIC).filter((p) => p.activationConditions !== undefined).length).toBe(1);
    // `this land entered this turn or if you control a basic land` is outside the reader: the line stays conditional.
    expect(prods(LAIR).some((p) => p.conditional && p.activationConditions === undefined)).toBe(true);
  });

  test('the Verge: its gated colour offered only while the gate holds, and the tap refused without it', () => {
    const g = table();
    const verge = put(g, 'p1', VERGE);
    settle(g);
    expect(colours(g, verge), 'no Swamp, no Forest: Green alone').toEqual(['G']);
    const gated = prods(VERGE).find((p) => p.activationConditions !== undefined);
    if (!gated) throw new Error('no gated line');
    const refused = g.submit({ t: 'TapForMana', player: 'p1', card: verge, abilityIndex: gated.abilityIndex, outputChoice: 0 });
    expect(refused.ok, 'the gate does not hold').toBe(false);
    put(g, 'p1', 'Forest');
    settle(g);
    expect(colours(g, verge).sort(), 'a Forest: Black too').toEqual(['B', 'G']);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: verge, abilityIndex: gated.abilityIndex, outputChoice: 0 }));
    expect(g.state.players['p1']?.pool.B).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the Temple counts five lands; the Mox counts three artifacts', () => {
    const g = table();
    const temple = put(g, 'p1', TEMPLE);
    settle(g);
    expect(sourcesOf(g, temple)).toEqual([]);
    for (const n of ['Island', 'Island', 'Island', 'Island']) put(g, 'p1', n);
    settle(g);
    expect(colours(g, temple), 'five lands').toEqual(['CC']);
    const mox = put(g, 'p1', MOX);
    settle(g);
    expect(sourcesOf(g, mox)).toEqual([]);
    put(g, 'p1', 'Sol Ring');
    put(g, 'p1', 'Ornithopter');
    settle(g);
    expect(sourcesOf(g, mox).length, 'three artifacts: any colour').toBeGreaterThan(0);
  });

  test('the gated cards run completely', () => {
    for (const name of [VERGE, TEMPLE, MOX, FANATIC]) expect(isEngineComplete(ORACLE.byName(name)?.data as CardData), name).toBe(true);
  });
});
