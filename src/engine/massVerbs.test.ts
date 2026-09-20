// D505 - THE MASS VERBS OVER A SCOPE. `Put a +1/+1 counter on each creature you control.` / `Tap all creatures your
// opponents control.` / `Untap all creatures you control.` (and `each other creature`, `each Merfolk creature you
// control`, `all lands you control`, `all nonland permanents you control`) read through the wide scope and walk the
// board as they run: one event over every member, a `ScopeWalked` marker beside it, the members riding the events for
// the object verbs after the clause (D500). What is proven here: the readings (and the shapes refused - an X count,
// `target player controls`); Vitalize untapping p1's tapped Bears and leaving p2's tapped Cyclops alone; Bond of
// Discipline tapping p2's creatures and none of p1's, the lifelink granted beside it; The Crystal's Chosen putting a
// counter on each of p1's creatures including the four Heroes it just made, and none on p2's; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, ...(e.scopes && e.scopes.length > 0 ? { scope: e.scopes[0] } : {}), ...(e.counterKind ? { counterKind: e.counterKind, amount: e.amount } : {}) })) }; };
const walked = (g: Game) => g.log.filter((e) => e.body.t === 'ScopeWalked').map((e) => (e.body.t === 'ScopeWalked' ? `${e.body.verb}:${e.body.members}` : ''));
const creaturesOf = (g: Game, who: 'p1' | 'p2') => g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === who);

describe('D505 - the mass verbs over a scope', () => {
  test('the readings: the counter on each, the tap and the untap over the wide scope; the shapes refused', () => {
    expect(kinds('Put a +1/+1 counter on each creature you control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massCounters', scope: { kind: 'creature', controller: 'you' }, counterKind: '+1/+1', amount: 1 }] });
    expect(kinds('Put two +1/+1 counters on each other creature you control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massCounters', scope: { kind: 'creature', controller: 'you', other: true }, counterKind: '+1/+1', amount: 2 }] });
    expect(kinds('Put a stun counter on each creature you don\'t control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massCounters', scope: { kind: 'creature', controller: 'opponents' }, counterKind: 'stun', amount: 1 }] });
    expect(kinds('Put a +1/+1 counter on each Merfolk creature you control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massCounters', scope: { kind: 'creature', controller: 'you', subtype: 'Merfolk' }, counterKind: '+1/+1', amount: 1 }] });
    expect(kinds('Put a +1/+1 counter on each Fractal you control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massCounters', scope: { kind: 'creature', controller: 'you', subtype: 'Fractal' }, counterKind: '+1/+1', amount: 1 }] });
    expect(kinds('Tap all creatures your opponents control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massTap', scope: { kind: 'creature', controller: 'opponents' } }] });
    expect(kinds('Tap all other creatures.')).toEqual({ mode: 'auto', effects: [{ kind: 'massTap', scope: { kind: 'creature', controller: 'any', other: true } }] });
    expect(kinds('Untap all creatures you control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massUntap', scope: { kind: 'creature', controller: 'you' } }] });
    expect(kinds('Untap each creature you control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massUntap', scope: { kind: 'creature', controller: 'you' } }] });
    expect(kinds('Untap all lands you control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massUntap', scope: { kind: 'permanent', controller: 'you', type: 'Land' } }] });
    expect(kinds('Untap all nonland permanents you control.')).toEqual({ mode: 'auto', effects: [{ kind: 'massUntap', scope: { kind: 'permanent', controller: 'you', nonland: true } }] });
    expect(kinds('Untap all attacking creatures.')).toEqual({ mode: 'auto', effects: [{ kind: 'massUntap', scope: { kind: 'creature', controller: 'any', attacking: true } }] });
    expect(kinds('Tap all creatures your opponents control. Creatures you control gain lifelink until end of turn.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'massTap' }, { kind: 'massPump' }] });
    expect(kinds('Put X -1/-1 counters on each creature.').mode, 'an X count: unread').not.toBe('auto');
    expect(kinds('Tap all creatures target player controls.').mode, 'target player controls: unread').not.toBe('auto');
    expect(kinds('Tap all untapped permanents of the chosen type target player controls.').mode).not.toBe('auto');
  });

  test("Vitalize: p1's tapped creatures untap, p2's tapped Cyclops stays tapped; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Vitalize', 'Grizzly Bears', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']] });
    holdEverywhere(g);
    const a = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const b = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const c = put(g, 'p2', 'Cyclops of One-Eyed Pass', 'battlefield');
    const spell = put(g, 'p1', 'Vitalize', 'hand');
    main(g, 3);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [a, b], tapped: true }));
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [c], tapped: true }));
    expect(g.state.cards[a]?.tapped).toBe(true);
    mana(g, 'p1', 'G');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(g.state.cards[a]?.tapped, 'the first Bears untapped').toBe(false);
    expect(g.state.cards[b]?.tapped, 'the second Bears untapped').toBe(false);
    expect(g.state.cards[c]?.tapped, "p2's Cyclops still tapped - outside the scope").toBe(true);
    expect(walked(g), 'two members walked').toEqual(['massUntap:2']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Bond of Discipline: p2's creatures tapped and none of p1's, lifelink granted beside it; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Bond of Discipline', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass', 'Grizzly Bears']] });
    holdEverywhere(g);
    const mine = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const c = put(g, 'p2', 'Cyclops of One-Eyed Pass', 'battlefield');
    const theirs = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Bond of Discipline', 'hand');
    main(g, 3);
    mana(g, 'p1', 'WWWWW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(g.state.cards[c]?.tapped, "p2's Cyclops tapped").toBe(true);
    expect(g.state.cards[theirs]?.tapped, "p2's Bears tapped").toBe(true);
    expect(g.state.cards[mine]?.tapped, "p1's Bears untouched").toBe(false);
    expect(g.log.some((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === mine && (e.body.keywords ?? []).includes('lifelink')), "p1's Bears gained lifelink until end of turn").toBe(true);
    expect(walked(g)).toEqual(['massTap:2']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("The Crystal's Chosen: a counter on each of p1's creatures including the four Heroes it made, none on p2's; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [["The Crystal's Chosen", 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']] });
    holdEverywhere(g);
    const mine = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const c = put(g, 'p2', 'Cyclops of One-Eyed Pass', 'battlefield');
    const spell = put(g, 'p1', "The Crystal's Chosen", 'hand');
    main(g, 3);
    mana(g, 'p1', 'WWWWWWW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    const p1 = creaturesOf(g, 'p1');
    expect(p1, 'the Bears and four Heroes').toHaveLength(5);
    for (const id of p1) expect(g.state.cards[id]?.counters['+1/+1'] ?? 0, 'a counter on each').toBe(1);
    expect(g.state.cards[mine]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(g.state.cards[c]?.counters['+1/+1'] ?? 0, "none on p2's Cyclops").toBe(0);
    expect(walked(g), 'five members walked').toEqual(['massCounters:5']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
