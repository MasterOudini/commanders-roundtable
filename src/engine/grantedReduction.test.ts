// D404 - THE BOARD-GRANTED COST REDUCTION (CR 601.2f): a permanent whose line says "<Kind> spells you
// cast cost {N} less to cast" (a Medallion, Etherium Sculptor) or "Spells cost {N} less to cast"
// (Helm of Awakening, everyone's) reduces the generic part of a matching spell's cost while it is
// on the battlefield. D312 read a spell's OWN reductions; this is the board's grants, read off the
// printed faces of the permanents in `castReduction`'s second pass, and the offer, the cast and the
// preview all price it through the same number (D53).

import { describe, expect, test } from 'vitest';
import { parseGrantedReductionLine } from '../data/costParse';
import { replay, stateHash } from './log';
import { advanceUntil, must, put, startedGame, ORACLE } from './testing/harness';
import { legalActions } from './legal';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number, player: 'p1' | 'p2' = 'p1') =>
  must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: sym, amount: n }));

describe('the board-granted cost reduction (D404)', () => {
  test('the line reads: a kind, an either-list, every spell, everyone; a coloured reduction does not', () => {
    expect(parseGrantedReductionLine('White spells you cast cost {1} less to cast.')).toMatchObject({ amount: 1, who: 'you', spells: [{ colors: ['W'] }] });
    expect(parseGrantedReductionLine('Instant and sorcery spells you cast cost {1} less to cast.')).toMatchObject({ amount: 1, who: 'you', spells: [{ types: ['Instant'] }, { types: ['Sorcery'] }] });
    expect(parseGrantedReductionLine('Merfolk spells and Wizard spells you cast cost {1} less to cast.')).toMatchObject({ spells: [{ subtypes: ['Merfolk'] }, { subtypes: ['Wizard'] }] });
    expect(parseGrantedReductionLine('Spells you cast cost {2} less to cast.')).toMatchObject({ amount: 2, who: 'you', spells: null });
    expect(parseGrantedReductionLine('Spells cost {1} less to cast.')).toMatchObject({ amount: 1, who: 'any', spells: null });
    expect(parseGrantedReductionLine('Artifact spells you cast cost {1} less to cast. (Reminder.)')).toMatchObject({ amount: 1 });
    expect(parseGrantedReductionLine('White spells you cast cost {W} less to cast.')).toBeNull();
    expect(parseGrantedReductionLine('Creature spells you cast cost {1} less to cast for each Elf you control.')).toBeNull();
    // D404 - a capitalised non-subtype at the line start is refused, not placed as a subtype.
    expect(parseGrantedReductionLine('Noncreature spells you cast cost {1} less to cast.')).toBeNull();
    expect(parseGrantedReductionLine('Colorless spells you cast cost {1} less to cast.')).toBeNull();
    expect(parseGrantedReductionLine('Colorless Eldrazi spells you cast cost {1} less to cast.')).toBeNull();
    expect(parseGrantedReductionLine('Face-down creature spells you cast cost {1} less to cast.')).toBeNull();
    const historic = parseGrantedReductionLine('Historic spells you cast cost {1} less to cast.');
    expect(historic?.spells?.map((p) => [p.supertypes, p.types, p.subtypes])).toEqual([[[], ['Artifact'], []], [['Legendary'], [], []], [[], [], ['Saga']]]);
    expect(ORACLE.byName('Pearl Medallion')?.faces[0]?.grantedReductions).toHaveLength(1);
  });

  test("a Medallion prices its controller's white spells down, not the opponent's and not a green one, never below the coloured part", () => {
    const scripts = createRegistry([...SHIPPED_SCRIPTS]);
    const g = startedGame({ players: 2, decks: [['Pearl Medallion', 'Blessed Wine', 'Grizzly Bears', 'Swords to Plowshares'], ['Blessed Wine', 'Grizzly Bears']], scripts });
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const wine = put(g, 'p1', 'Blessed Wine', 'hand');
    const offer0 = legalActions(g.state, ORACLE, scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === wine);
    expect(offer0?.t === 'CastSpell' ? offer0.tax : null, 'no reduction before the Medallion').toBe(0);
    const medallion = put(g, 'p1', 'Pearl Medallion');
    settle(g);
    const offer1 = legalActions(g.state, ORACLE, scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === wine);
    expect(offer1?.t === 'CastSpell' ? offer1.tax : null, 'the offer carries the reduction as a negative tax').toBe(-1);
    mana(g, 'W', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: wine }));
    settle(g);
    expect(g.state.cards[wine]?.zone.kind, '{1}{W} for {W} alone').toBe('graveyard');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    mana(g, 'G', 1);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: bears }).ok, 'a green spell is not reduced').toBe(false);
    mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    const swords = put(g, 'p1', 'Swords to Plowshares', 'hand');
    const target = put(g, 'p2', 'Grizzly Bears');
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: swords, targets: [{ kind: 'card', id: target }] }).ok, '{W} stays {W}').toBe(false);
    mana(g, 'W', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: swords, targets: [{ kind: 'card', id: target }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null, 20_000);
    const theirs = put(g, 'p2', 'Blessed Wine', 'hand');
    mana(g, 'W', 1, 'p2');
    expect(g.submit({ t: 'CastSpell', player: 'p2', card: theirs }).ok, 'the opponent pays {1}{W}').toBe(false);
    expect(g.state.cards[medallion]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Etherium Sculptor makes a {1} artifact free, and Helm of Awakening reduces everyone's spells", () => {
    const scripts = createRegistry([...SHIPPED_SCRIPTS]);
    const g = startedGame({ players: 2, decks: [['Etherium Sculptor', 'Sol Ring', 'Helm of Awakening', 'Grizzly Bears'], ['Grizzly Bears']], scripts });
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    put(g, 'p1', 'Etherium Sculptor');
    settle(g);
    const ring = put(g, 'p1', 'Sol Ring', 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ring }));
    settle(g);
    expect(g.state.cards[ring]?.zone.kind, 'a {1} artifact for nothing').toBe('battlefield');
    put(g, 'p1', 'Helm of Awakening');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null, 20_000);
    const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
    mana(g, 'G', 1, 'p2');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, "the Helm reduces the opponent's Bears to {G}").toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
