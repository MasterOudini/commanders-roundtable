// D325 - a mana ability's cost beside the {T} is CHARGED at the tap.
//
// The engine had always tapped "{1}, {T}: Add {B}{R}" for {B}{R} and never
// taken the {1}; the parser marked such a line conditional and the coverage
// accounting left it unrun. Now the parser records the chargeable pieces
// (mana from the pool, a life payment, the permanent's own sacrifice), the
// handler charges them, the legal-action menu offers the source only while
// they can be paid, and the solver still never auto-taps one (mana against
// mana is a price it does not model). A piece the engine cannot charge keeps
// the old behaviour to the letter: conditional, tapped by hand.

import { describe, expect, test } from 'vitest';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { manaSourcesOf } from './mana';
import { must, ORACLE, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function sourceOf(g: Game, id: InstanceId) {
  const s = manaSourcesOf(g.state, ORACLE, g.deps.scripts, 'p1', { includeConditional: true, includeCostly: true }).find((x) => x.card === id);
  if (!s) throw new Error('no mana source on the card');
  return s;
}

function poolTotalOf(g: Game): number {
  const p = g.state.players.p1?.pool;
  return p ? p.W + p.U + p.B + p.R + p.G + p.C : -1;
}

describe('D325 - a mana ability with a cost beside the {T}', () => {
  test('a Signet is never auto-tapped, is offered only while its {1} is in the pool, and charges it', () => {
    const g = startedGame({ decks: [['Rakdos Signet']] });
    const signet = put(g, 'p1', 'Rakdos Signet');
    // Never a solver source: the solver does not price mana against mana.
    expect(manaSourcesOf(g.state, ORACLE, g.deps.scripts, 'p1').filter((s) => s.card === signet)).toHaveLength(0);
    expect(manaSourcesOf(g.state, ORACLE, g.deps.scripts, 'p1', { includeConditional: true }).filter((s) => s.card === signet)).toHaveLength(0);
    const source = sourceOf(g, signet);
    expect(source.conditional).toBe(false);
    expect(source.extraCost?.mana?.generic).toBe(1);
    expect(source.extraCost?.life).toBe(0);
    const offered = (): boolean => legalActions(g.state, ORACLE, g.deps.scripts, 'p1').some((a) => a.t === 'TapForMana' && a.card === signet);
    expect(offered()).toBe(false);
    const refused = g.submit({ t: 'TapForMana', player: 'p1', card: signet, abilityIndex: source.abilityIndex, outputChoice: 0 });
    expect(refused.ok).toBe(false);
    expect(g.state.cards[signet]?.tapped).toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    expect(offered()).toBe(true);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: signet, abilityIndex: source.abilityIndex, outputChoice: 0 }));
    expect(g.state.cards[signet]?.tapped).toBe(true);
    expect(g.state.players.p1?.pool).toEqual({ W: 0, U: 0, B: 1, R: 1, G: 0, C: 0 });
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a life payment is charged', () => {
    const g = startedGame({ decks: [['Mana Confluence']] });
    const confluence = put(g, 'p1', 'Mana Confluence');
    const source = sourceOf(g, confluence);
    expect(source.conditional).toBe(false);
    expect(source.extraCost?.life).toBe(1);
    expect(source.extraCost?.mana).toBeNull();
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'TapForMana', player: 'p1', card: confluence, abilityIndex: source.abilityIndex, outputChoice: 0 }));
    expect(g.state.players.p1?.life).toBe(life0 - 1);
    expect(poolTotalOf(g)).toBe(1);
    expect(g.state.cards[confluence]?.tapped).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("the permanent's own sacrifice is charged", () => {
    const g = startedGame({ decks: [['Lotus Petal']] });
    const petal = put(g, 'p1', 'Lotus Petal');
    const source = sourceOf(g, petal);
    expect(source.conditional).toBe(false);
    expect(source.extraCost?.sacrificeSelf).toBe(true);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: petal, abilityIndex: source.abilityIndex, outputChoice: 0 }));
    expect(g.state.cards[petal]?.zone.kind).toBe('graveyard');
    expect(poolTotalOf(g)).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a piece the engine cannot charge keeps the line conditional, tapped by hand as before', () => {
    const g = startedGame({ decks: [['Springleaf Drum', 'Grizzly Bears']] });
    const drum = put(g, 'p1', 'Springleaf Drum');
    put(g, 'p1', 'Grizzly Bears');
    const source = sourceOf(g, drum);
    expect(source.conditional).toBe(true);
    expect(source.extraCost ?? null).toBeNull();
    const offer = legalActions(g.state, ORACLE, g.deps.scripts, 'p1').find((a) => a.t === 'TapForMana' && a.card === drum);
    expect(offer?.t === 'TapForMana' && offer.conditional).toBe(true);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: drum, abilityIndex: source.abilityIndex, outputChoice: 0 }));
    expect(g.state.cards[drum]?.tapped).toBe(true);
    expect(poolTotalOf(g)).toBe(1);
  });
});
