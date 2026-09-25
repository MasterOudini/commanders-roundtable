// D537 - RETRACE (CR 702.81) and JUMP-START (CR 702.133): a card cast from its owner's graveyard for its mana cost and a
// discard - a land card (retrace) or any card (jump-start) - charged as D406's additional cost. A retrace spell goes back
// to the graveyard as it leaves the stack; a jump-start spell is exiled, as a flashback spell is. What is proven here: the
// readings (the discard verb, the land filter, the three complete); Flame Jab offered from the graveyard with the land
// candidates, refused without a discard and with a nonland one, cast by discarding a Mountain and back in the graveyard;
// no land in hand, no offer; Chemister's Insight cast by discarding a card and exiled; a fizzle - the jump-start spell to
// exile, the retrace spell to the graveyard; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const offerFor = (g: Game, card: InstanceId) => legalActions(g.state, deps().oracle, deps().scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);
const mana = (g: Game, sym: 'U' | 'R' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const P2 = { kind: 'player', id: 'p2' } as const;

describe('D537 - retrace and jump-start', () => {
  test('the readings: the discard verb and its land filter, the three complete', () => {
    const jab = faceNamed('Flame Jab').graveyardCast;
    expect(jab?.kind).toBe('retrace');
    expect(jab?.verb.discardCost?.count).toBe(1);
    expect(jab?.verb.discardCost?.any, 'a land card').not.toBeNull();
    const insight = faceNamed("Chemister's Insight").graveyardCast;
    expect(insight?.kind).toBe('jumpStart');
    expect(insight?.verb.discardCost?.count).toBe(1);
    expect(insight?.verb.discardCost?.any, 'any card').toBeNull();
    expect(faceNamed('Grizzly Bears').graveyardCast).toBeNull();
    for (const name of ['Flame Jab', "Chemister's Insight", 'Direct Current']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('retrace: offered from the graveyard with the land candidates, a land discarded, the spell back in the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Flame Jab', 'Mountain', 'Grizzly Bears', 'Mountain', 'Mountain'], ['Mountain']] });
    holdEverywhere(g);
    const jab = put(g, 'p1', 'Flame Jab', 'graveyard');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    main3(g);
    // Only land cards pay: the offer lists the Mountain and not the Bears.
    const land = put(g, 'p1', 'Mountain', 'hand');
    mana(g, 'R', 1);
    const offer = offerFor(g, jab);
    expect(offer?.t === 'CastSpell' ? offer.from.kind : null).toBe('graveyard');
    expect(offer?.t === 'CastSpell' ? offer.discardCandidates : null).toContain(land);
    expect(offer?.t === 'CastSpell' ? offer.discardCandidates : null, 'a land card only').not.toContain(bears);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: jab, targets: [P2] }).ok, 'the discard is owed').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: jab, targets: [P2], discard: [bears] }).ok, 'not a land card').toBe(false);
    const life0 = life(g, 'p2');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: jab, targets: [P2], discard: [land] }));
    settle(g);
    expect(life(g, 'p2')).toBe(life0 - 1);
    expect(g.state.cards[land]?.zone.kind, 'the land paid').toBe('graveyard');
    expect(g.state.cards[jab]?.zone.kind, 'retrace sends it back to the graveyard').toBe('graveyard');
    // No land card left in hand (the harness deals basics of every type): no offer at all.
    for (const id of [...(g.state.zones.hand.p1 ?? [])]) {
      const printing = deps().oracle.byPrinting(g.state.cards[id]!.printingId);
      if (printing && faceOf(printing, 0).isLand) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' } }));
    }
    mana(g, 'R', 1);
    expect(offerFor(g, jab), 'no land card to discard').toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('jump-start: any card discarded, the spell resolved and then exiled', () => {
    const g = startedGame({ players: 2, decks: [["Chemister's Insight", 'Grizzly Bears', 'Island', 'Island', 'Island', 'Island', 'Island'], ['Mountain']] });
    holdEverywhere(g);
    const insight = put(g, 'p1', "Chemister's Insight", 'graveyard');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    main3(g);
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    const offer = offerFor(g, insight);
    expect(offer?.t === 'CastSpell' ? offer.discardCandidates : null).toContain(bears);
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: insight, targets: [], discard: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand.p1 ?? []).length, 'one discarded, two drawn').toBe(hand0 - 1 + 2);
    expect(g.state.cards[insight]?.zone.kind, 'jump-start exiles it').toBe('exile');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a fizzle: the jump-start spell to exile, the retrace spell to the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Direct Current', 'Flame Jab', 'Grizzly Bears', 'Mountain', 'Mountain', 'Mountain'], ['Grizzly Bears', 'Grizzly Bears']] });
    holdEverywhere(g);
    const current = put(g, 'p1', 'Direct Current', 'graveyard');
    const jab = put(g, 'p1', 'Flame Jab', 'graveyard');
    const discard1 = put(g, 'p1', 'Grizzly Bears', 'hand');
    const [m1, m2] = [put(g, 'p1', 'Mountain', 'hand'), put(g, 'p1', 'Mountain', 'hand')];
    const foe1 = put(g, 'p2', 'Grizzly Bears');
    const foe2 = put(g, 'p2', 'Grizzly Bears');
    main3(g);
    mana(g, 'R', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: current, targets: [{ kind: 'card', id: foe1 }], discard: [discard1] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: foe1, to: { kind: 'hand', player: 'p2' } }));
    settle(g);
    expect(g.state.cards[current]?.zone.kind, 'a fizzled jump-start spell is exiled').toBe('exile');
    mana(g, 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: jab, targets: [{ kind: 'card', id: foe2 }], discard: [m1] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: foe2, to: { kind: 'hand', player: 'p2' } }));
    settle(g);
    expect(g.state.cards[jab]?.zone.kind, 'a fizzled retrace spell goes back to the graveyard').toBe('graveyard');
    expect(g.state.cards[m2]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
