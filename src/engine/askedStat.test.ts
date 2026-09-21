// D515 - THE ASK'S CHOSEN CREATURE AS THE CONTINUATION'S OBJECTS. `Target opponent sacrifices a creature of their choice.
// You gain life equal to that creature's toughness.` (Tribute to Hunger): the sacrifice is the queue's question, the
// resolution stops at it (D484), and the clause after it is about the creature the answer chose - which the resumed
// frame binds as its previous objects (`resumeContinuation` names what the answer sacrificed and the stats as the answer
// found them, the board before its moves - CR 608.2h's last known information), the stat read taking the recorded
// toughness rather than the graveyard card's printed one. What is proven here: the readings (the possessive referent
// after a queued sacrifice is the `ofPrevious` stat read; after a targeted destroy it is the shared target); Tribute to
// Hunger against a Bears carrying two +1/+1 counters beside an Angel (p2 asked, answers with the Bears; p1 gains four -
// the counters counted - and the Bears is in the graveyard); against an empty board (nothing sacrificed, nothing read,
// said); the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, targetIndex: e.targetIndex, ...(e.ofPrevious ? { ofPrevious: true } : {}), ...(e.stat ? { stat: e.stat } : {}) })) }; };
const reads = (g: Game) => g.log.filter((e) => e.body.t === 'StatRead').map((e) => (e.body.t === 'StatRead' ? { stat: e.body.stat, value: e.body.value, lastKnown: e.body.lastKnown } : null));

describe("D515 - the ask's chosen creature as the continuation's objects", () => {
  test('the readings: after a queued sacrifice the stat read is about the previous objects; after a destroy it shares the target', () => {
    expect(kinds("Target opponent sacrifices a creature of their choice. You gain life equal to that creature's toughness.")).toEqual({
      mode: 'auto',
      effects: [{ kind: 'sacrifice', targetIndex: 0 }, { kind: 'gainLifeStat', targetIndex: -1, ofPrevious: true, stat: 'toughness' }],
    });
    expect(kinds('Destroy target creature. You gain life equal to its toughness.')).toEqual({ mode: 'auto', effects: [{ kind: 'destroy', targetIndex: 0 }, { kind: 'gainLifeStat', targetIndex: 0, stat: 'toughness' }] });
  });

  test('Tribute to Hunger: p2 sacrifices a Bears with two +1/+1 counters, p1 gains four (the counters counted, read last known); the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Tribute to Hunger'], ['Grizzly Bears', 'Serra Angel']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const angel = put(g, 'p2', 'Serra Angel', 'battlefield');
    const spell = put(g, 'p1', 'Tribute to Hunger', 'hand');
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: bears, kind: '+1/+1', delta: 2 }));
    main(g, 3);
    const life0 = g.state.players.p1?.life ?? 0;
    mana(g, 'p1', 'BCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    if (ask?.kind !== 'chooseFromZone') throw new Error('no ask');
    expect(ask.player, 'the opponent chooses').toBe('p2');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[angel]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life, 'four: the toughness as the answer found it, counters and all').toBe(life0 + 4);
    expect(reads(g)).toEqual([{ stat: 'toughness', value: 4, lastKnown: true }]);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Tribute to Hunger against an empty board: nothing sacrificed, nothing read, said; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Tribute to Hunger'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Tribute to Hunger', 'hand');
    main(g, 3);
    const life0 = g.state.players.p1?.life ?? 0;
    mana(g, 'p1', 'BCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0);
    expect(reads(g)).toEqual([]);
    expect(g.log.some((e) => e.body.t === 'Narrated' && /nothing for/.test(e.body.text)), 'the clause with nothing to act on says so').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
