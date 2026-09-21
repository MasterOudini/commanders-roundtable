// D514 - THE OBJECT'S STAT AS LAST KNOWN. `You gain life equal to that creature's toughness.` / `... its toughness.` is
// `gainLifeStat`, aimed at the creature the sentence is about - the previous clause's target through D392's referent
// (the possessive form, new here: `its` / `that creature's` is the previous phrase with an apostrophe-s), the item under a
// head through the row maker's rewrite. The amount is the creature's power or toughness as the executor finds it: on the
// battlefield as the step runs (the clauses before it applied - a pump counts), or, once it has left, as it last was
// before this resolution (CR 608.2h's last known information - the destroyed creature's toughness). A player phrase does
// not match the creature-only rule, so `Target opponent sacrifices a creature ... that creature's toughness` stays unread
// (the ask's chosen creature is a later seam). What is proven here: the readings; Sheltering Word on a Bears (+2, read
// live) and on a Bears carrying two +1/+1 counters (+4); the executor on a real stack object with the destroy-then-read
// text (the Angel in the graveyard, the read last known, +4) and with the pump-then-read text (+7, read live); the replay
// hash on the cast games.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { effectResult } from './effects';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, targetIndex: e.targetIndex, ...(e.stat ? { stat: e.stat } : {}) })) }; };
const reads = (g: Game) => g.log.filter((e) => e.body.t === 'StatRead').map((e) => (e.body.t === 'StatRead' ? { stat: e.body.stat, value: e.body.value, lastKnown: e.body.lastKnown } : null));

describe("D514 - the object's stat as last known", () => {
  test('the readings: the possessive referent after a target clause, the aimed form; a player phrase and a clash stay unread', () => {
    expect(kinds("Target creature you control gains hexproof until end of turn. You gain life equal to that creature's toughness.")).toEqual({
      mode: 'auto',
      effects: [{ kind: 'pump', targetIndex: 0 }, { kind: 'gainLifeStat', targetIndex: 0, stat: 'toughness' }],
    });
    expect(kinds('Destroy target creature. You gain life equal to its toughness.')).toEqual({ mode: 'auto', effects: [{ kind: 'destroy', targetIndex: 0 }, { kind: 'gainLifeStat', targetIndex: 0, stat: 'toughness' }] });
    expect(kinds("Regenerate target creature. You gain life equal to that creature's toughness.")).toMatchObject({ mode: 'auto', effects: [{ kind: 'regenerate' }, { kind: 'gainLifeStat', targetIndex: 0 }] });
    expect(kinds("You gain life equal to target creature's power.")).toEqual({ mode: 'auto', effects: [{ kind: 'gainLifeStat', targetIndex: 0, stat: 'power' }] });
    expect(kinds("Target opponent sacrifices a creature of their choice. You gain life equal to that creature's toughness.").mode, 'the ask\'s creature is not the target opponent').not.toBe('auto');
    expect(kinds("Destroy target creature. Clash with an opponent. If you win, you gain life equal to that creature's toughness.").mode).not.toBe('auto');
  });

  test('Sheltering Word on a Bears: the toughness read live, two life; on a Bears with two +1/+1 counters, four; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Sheltering Word', 'Sheltering Word', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const first = put(g, 'p1', 'Sheltering Word', 'hand');
    const second = put(g, 'p1', 'Sheltering Word', 'hand');
    main(g, 3);
    const life0 = g.state.players.p1?.life ?? 0;
    mana(g, 'p1', 'GC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: first, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 + 2);
    expect(reads(g)).toEqual([{ stat: 'toughness', value: 2, lastKnown: false }]);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 2 }));
    settle(g);
    mana(g, 'p1', 'GC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: second, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.players.p1?.life, 'the counters count: the toughness as it stands').toBe(life0 + 6);
    expect(reads(g)[1]).toEqual({ stat: 'toughness', value: 4, lastKnown: false });
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the executor on a real stack object: destroy then read - the Angel in the graveyard, the toughness as last known; pump then read - the toughness after the pump', () => {
    const g = startedGame({ players: 2, decks: [['Sheltering Word', 'Serra Angel'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const angel = put(g, 'p1', 'Serra Angel', 'battlefield');
    const spell = put(g, 'p1', 'Sheltering Word', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: angel }] }));
    advanceUntil(g, (s) => s.stack.length === 1 && s.priority.awaiting === null, 20_000);
    const obj = g.state.stack[0];
    if (!obj) throw new Error('no stack object');
    const destroyed = effectResult(g.state, g.deps, obj, parseEffects('Destroy target creature. You gain life equal to its toughness.', '~', true).effects);
    const moved = destroyed.events.find((e) => e.t === 'CardsMoved');
    expect(moved && moved.t === 'CardsMoved' ? moved.moves[0]?.to.kind : null, 'the Angel destroyed by the first clause').toBe('graveyard');
    expect(destroyed.events.filter((e) => e.t === 'StatRead')).toEqual([{ t: 'StatRead', card: angel, stat: 'toughness', value: 4, lastKnown: true }]);
    const gained = destroyed.events.find((e) => e.t === 'LifeChanged');
    expect(gained && gained.t === 'LifeChanged' ? gained.delta : null, 'four life - the toughness as last known').toBe(4);
    const pumped = effectResult(g.state, g.deps, obj, parseEffects('Target creature gets +3/+3 until end of turn. You gain life equal to its toughness.', '~', true).effects);
    expect(pumped.events.filter((e) => e.t === 'StatRead')).toEqual([{ t: 'StatRead', card: angel, stat: 'toughness', value: 7, lastKnown: false }]);
    const gained2 = pumped.events.find((e) => e.t === 'LifeChanged');
    expect(gained2 && gained2.t === 'LifeChanged' ? gained2.delta : null, 'seven life - the pump before the read counts').toBe(7);
    settle(g);
    expect(g.state.players.p1?.life, 'the real spell read the unpumped Angel: four').toBe(40 + 4);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
