// D541 - MADNESS (CR 702.35a): "If you discard this card, discard it into exile. When you do, cast it for its madness
// cost or put it into your graveyard." A built-in replacement sends the discard to exile (the move keeps its discard
// reason), a trigger off that exile offers the cast for the madness cost there and then (the free-cast chooser over a
// pool of one with a price, `madness.payable` the host's read), and a decline or a back-out puts the card into its
// owner's graveyard. What is proven here: the reading and the cards complete; Fiery Temper discarded as Tormenting
// Voice's cost, exiled and cast for {R} above the Voice; declined, to the graveyard; an unpayable Obsessive Search
// (the prompt says so, the cast refused, the decline to the graveyard); a targeted cast backed out of, to the
// graveyard; Reckless Wurm discarded to Mind Rot on the opponent's turn and cast then - the trigger's timing; a pool
// prompt answered with a card of the hand refused; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import type { TargetChoice } from './types/state';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Island', 'Island', 'Island', 'Island'];
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const toOffer = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.madness !== undefined, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, who: 'p1' | 'p2', sym: 'U' | 'R' | 'B' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: sym, amount: n }));
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind;
const P2: TargetChoice = { kind: 'player', id: 'p2' };

/** p1 casts Tormenting Voice discarding `card` (the additional cost), with `extraR` red left in the pool beside it. */
function voiceDiscarding(g: Game, voice: InstanceId, card: InstanceId, extraR: number) {
  mana(g, 'p1', 'R', 1 + extraR);
  mana(g, 'p1', 'C', 1);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: voice, discard: [card] }));
}

describe('D541 - madness', () => {
  test('the reading: the madness cost off the keyword line, the cards complete', () => {
    expect(faceNamed('Fiery Temper').madnessCost?.raw).toBe('{R}');
    expect(faceNamed('Reckless Wurm').madnessCost?.raw).toBe('{2}{R}');
    expect(faceNamed('Obsessive Search').madnessCost?.raw).toBe('{U}');
    expect(faceNamed('Grizzly Bears').madnessCost).toBeNull();
    expect(faceNamed('Fiery Temper').effectMode, 'the Madness line no clause of the spell').toBe('auto');
    for (const name of ['Fiery Temper', 'Reckless Wurm', 'Obsessive Search']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test("discarded as Tormenting Voice's cost: exiled, offered for {R}, cast above the Voice", () => {
    const g = startedGame({ players: 2, decks: [['Fiery Temper', 'Tormenting Voice', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const temper = put(g, 'p1', 'Fiery Temper', 'hand');
    const voice = put(g, 'p1', 'Tormenting Voice', 'hand');
    main(g, 3);
    const life0 = life(g, 'p2');
    voiceDiscarding(g, voice, temper, 2);
    expect(zoneOf(g, temper), 'discarded into exile').toBe('exile');
    expect(g.state.cards[temper]?.madnessExiled).toBe(true);
    const moved = g.log.find((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === temper && m.madness === true));
    expect(moved?.body.t === 'CardsMoved' ? moved.body.moves.find((m) => m.card === temper)?.reason : null, 'still a discard').toBe('discard');
    toOffer(g);
    const aw = g.state.priority.awaiting;
    expect(aw?.kind === 'chooseFromZone' ? aw.pool : null).toEqual([temper]);
    expect(aw?.kind === 'chooseFromZone' ? aw.madness : null).toEqual({ cost: '{R}', payable: true });
    expect(g.state.stack.map((o) => o.card), 'the Voice still waits beneath').toContain(voice);
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [temper] }));
    expect(g.state.pendingCast?.stage).toBe('targets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [P2] }));
    const spent = g.log.slice(n0).find((e) => e.body.t === 'ManaSpent');
    expect(spent?.body.t === 'ManaSpent' ? spent.body.mana : null, 'the madness cost, not {1}{R}{R}').toMatchObject({ R: 1, C: 0 });
    const cast = g.log.slice(n0).find((e) => e.body.t === 'SpellCast');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.castFrom?.kind : null).toBe('exile');
    settle(g);
    expect(life(g, 'p2'), 'three damage').toBe(life0 - 3);
    expect(zoneOf(g, temper)).toBe('graveyard');
    expect(g.state.cards[temper]?.madnessExiled).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declined: the card goes to its owner graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Fiery Temper', 'Tormenting Voice', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const temper = put(g, 'p1', 'Fiery Temper', 'hand');
    const voice = put(g, 'p1', 'Tormenting Voice', 'hand');
    main(g, 3);
    voiceDiscarding(g, voice, temper, 2);
    toOffer(g);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    expect(zoneOf(g, temper)).toBe('graveyard');
    expect(g.state.cards[temper]?.madnessExiled).toBeUndefined();
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('unpayable: the prompt says so, the cast is refused, the decline puts it in the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Obsessive Search', 'Tormenting Voice', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const search = put(g, 'p1', 'Obsessive Search', 'hand');
    const voice = put(g, 'p1', 'Tormenting Voice', 'hand');
    main(g, 3);
    voiceDiscarding(g, voice, search, 0);
    toOffer(g);
    const aw = g.state.priority.awaiting;
    expect(aw?.kind === 'chooseFromZone' ? aw.madness : null).toEqual({ cost: '{U}', payable: false });
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [search] }).ok, 'no blue mana').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    expect(zoneOf(g, search)).toBe('graveyard');
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a madness cast backed out of was not cast: to the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Fiery Temper', 'Tormenting Voice', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const temper = put(g, 'p1', 'Fiery Temper', 'hand');
    const voice = put(g, 'p1', 'Tormenting Voice', 'hand');
    main(g, 3);
    voiceDiscarding(g, voice, temper, 2);
    toOffer(g);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [temper] }));
    expect(zoneOf(g, temper)).toBe('stack');
    must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(zoneOf(g, temper)).toBe('graveyard');
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Reckless Wurm discarded to Mind Rot on the opponent's turn is cast then - the trigger's timing", () => {
    const g = startedGame({ players: 2, decks: [['Reckless Wurm', ...LANDS], ['Mind Rot', ...LANDS]] });
    holdEverywhere(g);
    const wurm = put(g, 'p1', 'Reckless Wurm', 'hand');
    const rot = put(g, 'p2', 'Mind Rot', 'hand');
    main(g, 4, 'p2');
    mana(g, 'p1', 'R', 1);
    mana(g, 'p1', 'C', 2);
    mana(g, 'p2', 'B', 1);
    mana(g, 'p2', 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p2', card: rot, targets: [{ kind: 'player', id: 'p1' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.player === 'p1', 20_000);
    const other = (g.state.zones.hand.p1 ?? []).find((id) => id !== wurm);
    if (other === undefined) throw new Error('p1 holds no second card');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [wurm, other] }));
    expect(zoneOf(g, wurm)).toBe('exile');
    expect(zoneOf(g, other), 'an ordinary discard').toBe('graveyard');
    toOffer(g);
    expect(g.state.turn.activePlayer, "the opponent's turn").toBe('p2');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [wurm] }));
    settle(g);
    expect(zoneOf(g, wurm), 'a creature cast at the trigger timing').toBe('battlefield');
    expect(g.state.cards[wurm]?.controller).toBe('p1');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a pool prompt answered with a card of the hand is refused', () => {
    const g = startedGame({ players: 2, decks: [['Fiery Temper', 'Tormenting Voice', 'Obsessive Search', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const temper = put(g, 'p1', 'Fiery Temper', 'hand');
    const voice = put(g, 'p1', 'Tormenting Voice', 'hand');
    const search = put(g, 'p1', 'Obsessive Search', 'hand');
    main(g, 3);
    voiceDiscarding(g, voice, temper, 2);
    toOffer(g);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [search] }).ok, 'not the pool card').toBe(false);
    expect(zoneOf(g, search)).toBe('hand');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
