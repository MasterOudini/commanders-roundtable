// D406 - THE ADDITIONAL COST AT CAST: "As an additional cost to cast this spell, <cost>." is the
// activated cost grammar's own phrase (a sacrifice, a discard, a tap, an exile from the graveyard, a
// return to hand, a life payment), read onto the face and charged by the cast - the picks named in
// the intent, checked against the offer's own candidate lists, paid in the cost batch ahead of the
// mana; `or pay {M}` is the verb's mana alternative. The line is claimed in the coverage and dropped
// from a spell's clauses, so Altar's Reap and its kin read whole.

import { describe, expect, test } from 'vitest';
import { parseAdditionalCost } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { engineCompleteness } from '../data/engineComplete';
import { primitiveFor } from '../data/primitives';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { legalActions } from './legal';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number, player: 'p1' | 'p2' = 'p1') =>
  must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: sym, amount: n }));
function armed(decks: readonly (readonly string[])[]): Game {
  const g = startedGame({ players: 2, decks, scripts: createRegistry([...SHIPPED_SCRIPTS]) });
  settle(g);
  const t0 = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}
const pc = (raw: string) => parseManaCost(raw);

describe('the additional cost at cast (D406)', () => {
  test('the line reads through the activated cost grammar: the five verbs, a life payment, the mana alternative; the rest is refused', () => {
    expect(parseAdditionalCost('As an additional cost to cast this spell, sacrifice a creature.\nDraw two cards.', pc)).toMatchObject({ costText: 'sacrifice a creature', sacrificeCost: { count: 1 }, orPay: null, lifeCost: 0 });
    expect(parseAdditionalCost('As an additional cost to cast this spell, sacrifice an artifact or creature.', pc)?.sacrificeCost?.any).toHaveLength(2);
    expect(parseAdditionalCost('As an additional cost to cast this spell, discard a card.', pc)).toMatchObject({ discardCost: { count: 1, atRandom: false } });
    expect(parseAdditionalCost('As an additional cost to cast this spell, discard two cards.', pc)).toMatchObject({ discardCost: { count: 2 } });
    expect(parseAdditionalCost('As an additional cost to cast this spell, pay 3 life.', pc)).toMatchObject({ lifeCost: 3 });
    expect(parseAdditionalCost('As an additional cost to cast this spell, tap two untapped creatures you control.', pc)).toMatchObject({ tapCost: { count: 2 } });
    expect(parseAdditionalCost('As an additional cost to cast this spell, exile a creature card from your graveyard.', pc)).toMatchObject({ exileFromGraveyardCost: { count: 1 } });
    expect(parseAdditionalCost("As an additional cost to cast this spell, return a land you control to its owner's hand.", pc)).toMatchObject({ returnCost: { count: 1 } });
    expect(parseAdditionalCost('As an additional cost to cast this spell, sacrifice a creature or pay {3}{B}.', pc)).toMatchObject({ sacrificeCost: { count: 1 }, orPay: { raw: '{3}{B}' } });
    expect(parseAdditionalCost('As an additional cost to cast this spell, pay {2} or sacrifice an artifact or creature.', pc)).toMatchObject({ sacrificeCost: { count: 1 }, orPay: { raw: '{2}' } });
    // Refused: a random discard, two verbs joined by or, a counter cost, a self cost, an unread phrase.
    expect(parseAdditionalCost('As an additional cost to cast this spell, discard a card at random.', pc)).toBeNull();
    expect(parseAdditionalCost('As an additional cost to cast this spell, sacrifice a creature or discard a card.', pc)).toBeNull();
    expect(parseAdditionalCost('As an additional cost to cast this spell, put a -1/-1 counter on a creature you control.', pc)).toBeNull();
    expect(parseAdditionalCost('As an additional cost to cast this spell, sacrifice all permanents you control and discard your hand.', pc)).toBeNull();
    expect(parseAdditionalCost('As an additional cost to cast this spell, you may collect evidence 6.', pc)).toBeNull();
    // The face, the claim, the classifier: Altar's Reap reads whole; a refused line stays structural.
    const reap = ORACLE.byName("Altar's Reap");
    expect(reap?.faces[0]?.additionalCost?.sacrificeCost?.count).toBe(1);
    expect(reap ? engineCompleteness(reap.data) : null).toEqual({ complete: true, leftover: [] });
    expect(ORACLE.byName('Eaten Alive')?.faces[0]?.additionalCost?.orPay?.raw).toBe('{3}{B}');
    const of = (text: string) => primitiveFor({ text, kind: 'sentence', raw: text }, 'Test Card', true);
    expect(of('As an additional cost to cast this spell, sacrifice a creature.')).toBe('scriptable');
    expect(of('As an additional cost to cast this spell, discard a card at random.')).not.toBe('scriptable');
  });

  test("Altar's Reap: the offer lists the sacrifice candidates, a cast without a pick is refused, a stranger's creature is refused, the Bears is sacrificed in the cost batch and two cards are drawn", () => {
    const g = armed([["Altar's Reap", 'Grizzly Bears', 'Raging Goblin'], ['Cyclops of One-Eyed Pass']]);
    const bears = put(g, 'p1', 'Grizzly Bears');
    put(g, 'p1', 'Raging Goblin');
    const theirs = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const reap = put(g, 'p1', "Altar's Reap", 'hand');
    const scripts = createRegistry([...SHIPPED_SCRIPTS]);
    const offer = legalActions(g.state, ORACLE, scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === reap);
    expect(offer?.t === 'CastSpell' ? offer.additionalCostText : null).toBe('sacrifice a creature');
    expect(offer?.t === 'CastSpell' ? offer.sacrificeCandidates?.length : null, 'the two creatures p1 controls').toBe(2);
    expect(offer?.t === 'CastSpell' ? offer.sacrificeCount : null).toBe(1);
    mana(g, 'B', 1);
    mana(g, 'C', 1);
    const noPick = g.submit({ t: 'CastSpell', player: 'p1', card: reap, targets: [] });
    expect(noPick.ok).toBe(false);
    if (!noPick.ok) expect(noPick.reason).toBe('needsSacrifice');
    const stranger = g.submit({ t: 'CastSpell', player: 'p1', card: reap, targets: [], sacrifice: [theirs] });
    expect(stranger.ok).toBe(false);
    if (!stranger.ok) expect(stranger.reason).toBe('illegalSacrifice');
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    const ok = g.submit({ t: 'CastSpell', player: 'p1', card: reap, targets: [], sacrifice: [bears] });
    expect(ok.ok, 'the Bears pays').toBe(true);
    expect(g.state.cards[bears]?.zone.kind, 'sacrificed in the cost batch, before the spell is on the stack').toBe('graveyard');
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === reap);
    expect(cast && cast.body.t === 'SpellCast' ? cast.body.obj.additionalPaid : null).toBe(1);
    const move = g.log.find((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === bears && m.to.kind === 'graveyard'));
    expect(move && move.body.t === 'CardsMoved' ? move.body.moves[0]?.reason : null, 'a sacrifice, for the watchers').toBe('sacrifice');
    settle(g);
    expect((g.state.zones.hand.p1 ?? []).length, 'the spell left the hand and two cards came').toBe(hand0 - 1 + 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    // With no creature left to sacrifice the spell is not offered at all.
    const reap2 = put(g, 'p1', "Altar's Reap", 'hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: g.state.zones.battlefield.find((id) => g.state.cards[id]?.controller === 'p1' && g.state.cards[id]?.zone.kind === 'battlefield') as string, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(legalActions(g.state, ORACLE, scripts, 'p1').some((a) => a.t === 'CastSpell' && a.card === reap2), 'no candidate, no offer').toBe(false);
  });

  test('Tormenting Voice discards the named card (never itself); Eaten Alive takes the mana alternative when no pick is named; Withering Boon takes the life', () => {
    const g = armed([['Tormenting Voice', 'Eaten Alive', 'Withering Boon', 'Raging Goblin', 'Forest', 'Island'], ['Cyclops of One-Eyed Pass', 'Grizzly Bears']]);
    holdEverywhere(g);
    const theirs = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const voice = put(g, 'p1', 'Tormenting Voice', 'hand');
    const fodder = put(g, 'p1', 'Forest', 'hand');
    mana(g, 'R', 1);
    mana(g, 'C', 1);
    const self = g.submit({ t: 'CastSpell', player: 'p1', card: voice, targets: [], discard: [voice] });
    expect(self.ok, 'a spell cannot pay its own discard').toBe(false);
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: voice, targets: [], discard: [fodder] }));
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
    settle(g);
    expect((g.state.zones.hand.p1 ?? []).length, 'the spell and the discard left, two cards came').toBe(hand0 - 2 + 2);
    // Eaten Alive: {B}, sacrifice a creature or pay {3}{B}; no pick names the mana alternative.
    const eaten = put(g, 'p1', 'Eaten Alive', 'hand');
    mana(g, 'B', 1);
    const short = g.submit({ t: 'CastSpell', player: 'p1', card: eaten, targets: [{ kind: 'card', id: theirs }] });
    expect(short.ok, '{B} alone cannot pay {B} plus {3}{B}').toBe(false);
    mana(g, 'B', 1);
    mana(g, 'C', 3);
    const paid = g.submit({ t: 'CastSpell', player: 'p1', card: eaten, targets: [{ kind: 'card', id: theirs }] });
    expect(paid.ok, 'the mana alternative').toBe(true);
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === eaten);
    expect(cast && cast.body.t === 'SpellCast' ? cast.body.obj.additionalPaid : null).toBe(1);
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind, 'the Cyclops is exiled').toBe('exile');
    // Withering Boon: {1}{B}, pay 3 life; the life rides the plan.
    const boon = put(g, 'p1', 'Withering Boon', 'hand');
    const bearsSpell = put(g, 'p2', 'Grizzly Bears', 'hand');
    const tNow = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === tNow + 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null, 20_000);
    mana(g, 'G', 2, 'p2');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bearsSpell, targets: [] }));
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    expect(g.state.priority.player, 'p1 answers with the Bears on the stack').toBe('p1');
    const life0 = g.state.players.p1?.life ?? 0;
    mana(g, 'B', 1);
    mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: boon, targets: [{ kind: 'stack', id: g.state.stack[g.state.stack.length - 1]?.id as string }] }));
    expect(g.state.players.p1?.life, 'three life paid with the mana').toBe(life0 - 3);
    settle(g);
    expect(g.state.cards[bearsSpell]?.zone.kind, 'the creature spell was countered').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
