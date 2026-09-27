// D568 - ESCAPE (CR 702.138): "You may cast this card from your graveyard by paying [cost] rather than paying its mana
// cost." Retrace's and jump-start's graveyard cast (D537) with its own mana - the escape cost - and no exile as it
// leaves the stack; the exile of N OTHER graveyard cards is its verb, charged as the additional cost. `This creature
// escapes with N +1/+1 counters on it.` (CR 702.138c) rides the entry (sunburst's path). What is proven here: the
// reading (the Escape line is the face's graveyard cast with its mana and its verb, and it leaves the spell's text; the
// rider is the permanent's); Sweet Oblivion is offered from the graveyard with the four OTHER cards as candidates,
// refused on three, escaped for {3}{U} with four - p2 mills four, the four are exiled, Sweet Oblivion goes back to the
// graveyard; Loathsome Chimera escaped enters with its +1/+1 counter, and cast from the hand enters with none; the
// replay hash on each.
import { describe, expect, test } from 'vitest';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const ISLANDS = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const mana = (g: Game, symbol: 'U' | 'G' | 'C', amount: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
const counters = (g: Game, id: InstanceId, kind: string): number => g.state.cards[id]?.counters?.[kind] ?? 0;
const graveyardOffer = (g: Game, card: InstanceId) => legalActions(g.state, deps().oracle, deps().scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card && a.from.kind === 'graveyard');

describe('D568 - escape', () => {
  test("the reading: the Escape line is the face's graveyard cast - its own mana, its verb - and leaves the spell's text; the rider is the permanent's", () => {
    const oblivion = ORACLE.byName('Sweet Oblivion')?.faces[0];
    expect(oblivion?.graveyardCast?.kind).toBe('escape');
    expect(oblivion?.graveyardCast?.mana?.raw).toBe('{3}{U}');
    expect(oblivion?.graveyardCast?.verb.exileFromGraveyardCost).toEqual({ count: 4, any: null, another: true });
    expect(oblivion?.graveyardCast?.verb.mana).toBeNull();
    expect(oblivion?.effectMode).toBe('auto');
    expect(oblivion?.effects.map((e) => e.kind)).toEqual(['mill']);
    const chimera = ORACLE.byName('Loathsome Chimera')?.faces[0];
    expect(chimera?.graveyardCast?.kind).toBe('escape');
    expect(chimera?.escapesWith).toEqual({ counters: 1, line: 'This creature escapes with a +1/+1 counter on it.' });
  });

  test('Sweet Oblivion escapes for {3}{U} and four OTHER cards - refused on three - and goes back to the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Sweet Oblivion', ...ISLANDS], ['Grizzly Bears', ...ISLANDS]] });
    holdEverywhere(g);
    const oblivion = put(g, 'p1', 'Sweet Oblivion', 'graveyard');
    const others = [put(g, 'p1', 'Island', 'graveyard'), put(g, 'p1', 'Island', 'graveyard'), put(g, 'p1', 'Island', 'graveyard'), put(g, 'p1', 'Island', 'graveyard')];
    main3(g);
    const offer = graveyardOffer(g, oblivion);
    expect(offer?.t === 'CastSpell' ? [...(offer.exileFromGraveyardCandidates ?? [])].sort() : null, 'the four others, never itself').toEqual([...others].sort());
    expect(offer?.t === 'CastSpell' ? offer.exileFromGraveyardCount : null).toBe(4);
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: oblivion, targets: [{ kind: 'player', id: 'p2' }], exileFromGraveyard: others.slice(0, 3) }).ok, 'three are not four').toBe(false);
    const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: oblivion, targets: [{ kind: 'player', id: 'p2' }], exileFromGraveyard: others }));
    settle(g);
    expect(others.every((id) => g.state.cards[id]?.zone.kind === 'exile'), 'the four exiled').toBe(true);
    expect((g.state.zones.graveyard.p2 ?? []).length, 'p2 milled four').toBe(p2gy0 + 4);
    expect(g.state.cards[oblivion]?.zone.kind, 'no exile as it leaves the stack - it may escape again').toBe('graveyard');
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === oblivion);
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.escaped : null).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Loathsome Chimera escaped enters with its +1/+1 counter; cast from the hand, with none', () => {
    const g = startedGame({ players: 2, decks: [['Loathsome Chimera', 'Loathsome Chimera', ...ISLANDS], ['Grizzly Bears', ...ISLANDS]] });
    holdEverywhere(g);
    const escaped = put(g, 'p1', 'Loathsome Chimera', 'graveyard');
    const others = [put(g, 'p1', 'Island', 'graveyard'), put(g, 'p1', 'Island', 'graveyard'), put(g, 'p1', 'Island', 'graveyard')];
    const fromHand = put(g, 'p1', 'Loathsome Chimera', 'hand');
    main3(g);
    mana(g, 'G', 1);
    mana(g, 'C', 4);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: escaped, targets: [], exileFromGraveyard: others }));
    settle(g);
    expect(g.state.cards[escaped]?.zone.kind).toBe('battlefield');
    expect(counters(g, escaped, '+1/+1'), 'it escaped with a +1/+1 counter').toBe(1);
    mana(g, 'G', 1);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: fromHand, targets: [] }));
    settle(g);
    expect(g.state.cards[fromHand]?.zone.kind).toBe('battlefield');
    expect(counters(g, fromHand, '+1/+1'), 'cast from the hand - no escape, no counter').toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
