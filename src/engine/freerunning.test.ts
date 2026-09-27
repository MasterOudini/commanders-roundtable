// D566 - FREERUNNING (CR 702.173a): "You may cast this spell for its freerunning cost if you dealt combat damage to a
// player this turn with an Assassin or commander." A keyword alternative cost with no rider (D449's line) under a new
// activation condition, `freerunning`, asked of the turn record's combat damagers (`TurnMemory.combatDamagers` - the
// sources that dealt combat damage to a player, with the controller each had as it dealt it). What is proven here: the
// reading (the Freerunning line is the face's alternative cost under the condition, and it leaves the spell's text);
// Eagle Vision is not freerun before combat, and is once Hired Poisoner (an Assassin) hits - three cards for {1}{U}, the
// condition the caster's alone, the record emptied with the turn; a Grizzly Bears hit does not open it; a commander's hit
// does (Kess); the replay hash on each.
import { describe, expect, test } from 'vitest';
import { activationConditionsHold } from './activationConditions';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const ISLANDS = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const offered = (g: Game, card: InstanceId): boolean | null => {
  const offer = legalActions(g.state, deps().oracle, deps().scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);
  return offer?.t === 'CastSpell' ? (offer.alternativeAvailable ?? null) : null;
};
const hand = (g: Game) => (g.state.zones.hand.p1 ?? []).length;
function attackWith(g: Game, attacker: InstanceId): void {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: attacker, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
}

describe('D566 - freerunning', () => {
  test("the reading: the Freerunning line is the face's alternative cost under its condition, and leaves the spell's text", () => {
    const vision = ORACLE.byName('Eagle Vision')?.faces[0];
    expect(vision?.alternativeCost?.keyword).toBe('freerunning');
    expect(vision?.alternativeCost?.mana?.raw).toBe('{1}{U}');
    expect(vision?.alternativeCost?.conditions).toEqual([{ kind: 'freerunning' }]);
    expect(vision?.effectMode).toBe('auto');
    expect(vision?.effects.map((e) => e.kind)).toEqual(['draw']);
    const harlequin = ORACLE.byName('Merciless Harlequin')?.faces[0];
    expect(harlequin?.alternativeCost?.keyword).toBe('freerunning');
    expect(harlequin?.alternativeCost?.mana?.raw).toBe('{1}{B}');
  });

  test("an Assassin's hit opens it: Eagle Vision for {1}{U} draws three, the condition the caster's alone, emptied with the turn", () => {
    const g = startedGame({ players: 2, decks: [['Eagle Vision', 'Hired Poisoner', ...ISLANDS], ['Grizzly Bears', ...ISLANDS]] });
    holdEverywhere(g);
    const poisoner = put(g, 'p1', 'Hired Poisoner');
    const vision = put(g, 'p1', 'Eagle Vision', 'hand');
    main3(g);
    expect(offered(g, vision), 'no combat damage yet').toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: vision, targets: [], alternative: true }).ok, 'not freerun before combat').toBe(false);
    attackWith(g, poisoner);
    expect(g.state.players.p2?.life, 'the Poisoner hit').toBe(39);
    expect(g.state.turn.memory.combatDamagers).toEqual([{ card: poisoner, controller: 'p1' }]);
    expect(offered(g, vision), 'an Assassin dealt combat damage to a player').toBe(true);
    expect(activationConditionsHold(g.state, deps().oracle, deps().scripts, 'p2', vision, [{ kind: 'freerunning' }]), "the hit was p1's, not p2's").toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    const hand0 = hand(g);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: vision, targets: [], alternative: true }));
    settle(g);
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === vision);
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.alternativePaid : null).toBe(true);
    expect(hand(g), 'three cards for the one cast').toBe(hand0 - 1 + 3);
    expect(g.state.cards[vision]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'upkeep', 40_000);
    expect(g.state.turn.memory.combatDamagers, 'the record empties with the turn').toEqual([]);
  });

  test('a Grizzly Bears hit does not open it', () => {
    const g = startedGame({ players: 2, decks: [['Eagle Vision', 'Grizzly Bears', ...ISLANDS], ['Grizzly Bears', ...ISLANDS]] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const vision = put(g, 'p1', 'Eagle Vision', 'hand');
    main3(g);
    attackWith(g, bears);
    expect(g.state.players.p2?.life, 'the Bears hit').toBe(38);
    expect(g.state.turn.memory.combatDamagers).toEqual([{ card: bears, controller: 'p1' }]);
    expect(offered(g, vision), 'a Bear is no Assassin and no commander').toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: vision, targets: [], alternative: true }).ok).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the verb form: Escape Detection returns a blue creature for its freerunning cost, bounces the Bears and draws', () => {
    const escape0 = ORACLE.byName('Escape Detection')?.faces[0]?.alternativeCost;
    expect(escape0?.keyword).toBe('freerunning');
    expect(escape0?.mana).toBeNull();
    expect(escape0?.returnCost?.count).toBe(1);
    expect(escape0?.conditions).toEqual([{ kind: 'freerunning' }]);
    const g = startedGame({ players: 2, decks: [['Escape Detection', 'Hired Poisoner', 'Talrand, Sky Summoner', ...ISLANDS], ['Grizzly Bears', ...ISLANDS]] });
    holdEverywhere(g);
    const poisoner = put(g, 'p1', 'Hired Poisoner');
    const talrand = put(g, 'p1', 'Talrand, Sky Summoner');
    const bears = put(g, 'p2', 'Grizzly Bears');
    const escape = put(g, 'p1', 'Escape Detection', 'hand');
    main3(g);
    attackWith(g, poisoner);
    expect(g.state.players.p2?.life, 'the Poisoner hit').toBe(39);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: escape, targets: [{ kind: 'card', id: bears }], alternative: true, returnToHand: [poisoner] }).ok, 'the Poisoner is not blue').toBe(false);
    const hand0 = hand(g);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: escape, targets: [{ kind: 'card', id: bears }], alternative: true, returnToHand: [talrand] }));
    settle(g);
    expect(g.state.cards[talrand]?.zone.kind, 'Talrand paid the cost').toBe('hand');
    expect(g.state.cards[bears]?.zone.kind, 'the Bears bounced').toBe('hand');
    expect(hand(g), 'the spell left, Talrand came back, a card drawn').toBe(hand0 - 1 + 1 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("a commander's hit opens it (Kess)", () => {
    const g = startedGame({ players: 2, decks: [['Eagle Vision', ...ISLANDS], ['Grizzly Bears', ...ISLANDS]] });
    holdEverywhere(g);
    const kess = g.state.zones.command.p1?.[0] as InstanceId;
    expect(g.state.cards[kess]?.isCommander).toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'battlefield', player: 'p1' } }));
    const vision = put(g, 'p1', 'Eagle Vision', 'hand');
    main3(g);
    attackWith(g, kess);
    expect(g.state.players.p2?.life, 'Kess hit').toBe(37);
    expect(offered(g, vision), 'a commander dealt combat damage to a player').toBe(true);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: vision, targets: [], alternative: true }));
    settle(g);
    expect(g.state.cards[vision]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
