// D510 - THE MASS CAN'T-BLOCK. `Creatures without flying can't block this turn.` (Falter, Seismic Stomp, Magmatic Chasm,
// Tectonic Rift, Fire of Orthanc) / `Creatures can't block this turn.` / `Creatures with flying can't block this turn.`
// is the can't-block rider over every creature the scope reaches (D505's walk, the keyword-absent form), the marker
// `ScopeWalked` with verb `massCantBlock` first. What is proven here: the readings (the three forms; the adjective form
// left unread); Falter with a Bears and a Serra Angel on each side (the Bears cannot block, the Angel can, both sides,
// the marker counts three); the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, scopes: e.scopes })) }; };
const cantBlock = (g: Game, id: string) => g.state.untilEndOfTurn.some((m) => m.card === id && m.cantBlock === true);

describe("D510 - the mass can't-block", () => {
  test('the readings: without flying, with flying, every creature; an adjective form stays unread', () => {
    expect(kinds("Creatures without flying can't block this turn.")).toEqual({ mode: 'auto', effects: [{ kind: 'cantBlock', scopes: [{ kind: 'creature', controller: 'any', keyword: 'flying', keywordAbsent: true }] }] });
    expect(kinds("Creatures with flying can't block this turn.")).toEqual({ mode: 'auto', effects: [{ kind: 'cantBlock', scopes: [{ kind: 'creature', controller: 'any', keyword: 'flying', keywordAbsent: false }] }] });
    expect(kinds("Creatures can't block this turn.")).toEqual({ mode: 'auto', effects: [{ kind: 'cantBlock', scopes: [{ kind: 'creature', controller: 'any' }] }] });
    expect(kinds("Destroy target land. Creatures without flying can't block this turn.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'destroy' }, { kind: 'cantBlock' }] });
    expect(kinds("Nonartifact creatures can't block this turn.").mode, 'an adjective the scope reader lacks').not.toBe('auto');
  });

  test('Falter: the Bears on each side cannot block, the Angels can; the marker counts the walk; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Falter', 'Grizzly Bears', 'Serra Angel'], ['Grizzly Bears', 'Serra Angel']] });
    holdEverywhere(g);
    const b1 = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const a1 = put(g, 'p1', 'Serra Angel', 'battlefield');
    const b2 = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const a2 = put(g, 'p2', 'Serra Angel', 'battlefield');
    const spell = put(g, 'p1', 'Falter', 'hand');
    main(g, 3);
    mana(g, 'p1', 'RR');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(cantBlock(g, b1), "p1's Bears cannot block").toBe(true);
    expect(cantBlock(g, b2), "p2's Bears cannot block").toBe(true);
    expect(cantBlock(g, a1), "p1's Angel flies").toBe(false);
    expect(cantBlock(g, a2), "p2's Angel flies").toBe(false);
    const walked = g.log.filter((e) => e.body.t === 'ScopeWalked' && e.body.verb === 'massCantBlock');
    expect(walked).toHaveLength(1);
    expect(walked[0]?.body.t === 'ScopeWalked' ? walked[0].body.members : -1, 'the two Bears').toBe(2);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
