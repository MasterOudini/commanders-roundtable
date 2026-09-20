// D509 - THE CONTROLLER WORD ON EVERY TARGET NOUN. `target permanent an opponent controls` (Assassin's Trophy), `target
// artifact or land an opponent controls` (Price of Freedom), `target artifact creature you control`, `target nonbasic land
// an opponent controls`: the effect parser's target macro admits the controller word after any noun of its table,
// because the target parser has read it off every noun since D407 and the targeting layer enforces it on every
// candidate (D139's order: enforce first, then admit the wording). What is proven here: the readings (the three words on
// nouns the table spelled only bare; a noun outside the table still unread); Assassin's Trophy aimed at p1's own Bears is
// refused and at p2's Bears destroys them and asks p2 to search (D507's referent); Price of Freedom on p2's Forest; the
// replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { parseTargetClauses } from '../data/targetParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, kinds: p.effects.map((e) => e.kind), targets: parseTargetClauses(text).map((c) => ({ ok: c.confident, kinds: [...c.kinds], controller: c.controller })) }; };

describe('D509 - the controller word on every target noun', () => {
  test('the readings: the three words on nouns the table spelled only bare; the qualifier after; a noun outside the table still unread', () => {
    expect(kinds('Destroy target permanent an opponent controls.')).toEqual({ mode: 'auto', kinds: ['destroy'], targets: [{ ok: true, kinds: ['permanent'], controller: 'opponent' }] });
    expect(kinds('Destroy target artifact or land an opponent controls.')).toMatchObject({ mode: 'auto', kinds: ['destroy'], targets: [{ ok: true, controller: 'opponent' }] });
    expect(kinds('Target artifact creature you control gets +2/+2 until end of turn.')).toMatchObject({ mode: 'auto', kinds: ['pump'], targets: [{ ok: true, controller: 'you' }] });
    expect(kinds('Tap target nonbasic land an opponent controls.')).toMatchObject({ mode: 'auto', kinds: ['tap'], targets: [{ ok: true, kinds: ['land'], controller: 'opponent' }] });
    expect(kinds("Destroy target artifact you don't control.")).toMatchObject({ mode: 'auto', kinds: ['destroy'], targets: [{ ok: true, kinds: ['artifact'], controller: 'opponent' }] });
    expect(kinds('Exile target creature or Vehicle an opponent controls.')).toMatchObject({ mode: 'auto', kinds: ['exile'], targets: [{ ok: true, controller: 'opponent' }] });
    expect(kinds('Destroy target creature an opponent controls with flying.')).toMatchObject({ mode: 'auto', kinds: ['destroy'] });
    expect(kinds('Destroy target permanent an opponent controls. Its controller may search their library for a basic land card, put it onto the battlefield, then shuffle.')).toMatchObject({ mode: 'auto', kinds: ['destroy', 'search'] });
    expect(kinds('Destroy target Vehicle an opponent controls.').mode).toBe('auto');
    expect(kinds('Destroy target Saga an opponent controls.').mode, 'a subtype noun is the tribal target (D479)').toBe('auto');
    expect(kinds('Destroy target battle an opponent controls.').mode, 'a noun outside the table stays unread').not.toBe('auto');
  });

  test("Assassin's Trophy: p1's own Bears are not a legal target; p2's Bears are destroyed and p2 is asked to search; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [["Assassin's Trophy", 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const mine = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const theirs = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', "Assassin's Trophy", 'hand');
    main(g, 3);
    mana(g, 'p1', 'BG');
    const refused = g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: mine }] });
    expect(refused.ok, 'a permanent p1 controls is not one an opponent controls').toBe(false);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: theirs }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'searchLibrary' ? ask.player : null, 'the search is asked of p2').toBe('p2');
    expect(g.state.cards[theirs]?.zone, "the Bears in p2's graveyard").toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[mine]?.zone.kind, "p1's Bears untouched").toBe('battlefield');
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [], declined: true }));
    settle(g);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Price of Freedom on p2's Forest: destroyed, p2 looks and finds nothing, then p1 draws; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Price of Freedom'], ['Forest']] });
    holdEverywhere(g);
    const forest = put(g, 'p2', 'Forest', 'battlefield');
    const spell = put(g, 'p1', 'Price of Freedom', 'hand');
    main(g, 3);
    const handBefore = (g.state.zones.hand.p1 ?? []).length;
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: forest }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [], declined: false }));
    const stage = g.state.priority.awaiting;
    expect(stage?.kind === 'searchLibrary' ? stage.optional : null).toBe(false);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [], declined: false }));
    settle(g);
    expect(g.state.cards[forest]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect((g.state.zones.hand.p1 ?? []).length, 'the draw after the answer').toBe(handBefore);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
