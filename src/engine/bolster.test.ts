// D511 - BOLSTER N (CR 701.37). `Bolster 3.` (Cached Defenses, Dromoka's Gift, Honor's Reward, Map the Wastes, Pinion Feast)
// - choose a creature with the least toughness among creatures you control and put N +1/+1 counters on it - is the queue's
// sixth verb: the candidates are computed (`leastToughnessCreatures`), a tie is asked of the caster (the prompt says
// `pick: 'leastToughness'` - a printed rule, never ids), the only one goes unasked, none does nothing. What is proven
// here: the readings (the count; `Bolster X` and the `, then` form left unread); Cached Defenses with a Bears (2/2) and a
// Serra Angel (4/4) - the Bears alone is least and gets three counters unasked; with two Bears - the tie asked, the
// Angel refused, the chosen Bears gets the counters and the other none; with no creature - nothing, said; Honor's Reward's
// life first, then the bolster; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, amount: e.amount })) }; };
const plus = (g: Game, id: string) => g.state.cards[id]?.counters['+1/+1'] ?? 0;
const bolsters = (g: Game) => g.log.filter((e) => e.body.t === 'Bolstered').length;

describe('D511 - bolster', () => {
  test('the readings: the count; Bolster X and the then form stay unread', () => {
    expect(kinds('Bolster 3.')).toEqual({ mode: 'auto', effects: [{ kind: 'bolster', amount: 3 }] });
    expect(kinds('You gain 4 life. Bolster 2.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'gainLife', amount: 4 }, { kind: 'bolster', amount: 2 }] });
    expect(kinds('Destroy target creature with flying. Bolster 2.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'destroy' }, { kind: 'bolster', amount: 2 }] });
    expect(kinds('Bolster X, where X is the number of cards in your hand.').mode).not.toBe('auto');
    expect(kinds('Bolster 1, then put a +1/+1 counter on each creature you control with a +1/+1 counter on it.').mode).not.toBe('auto');
  });

  test('Cached Defenses with a Bears and an Angel: the Bears alone is least and gets three counters unasked; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Cached Defenses', 'Grizzly Bears', 'Serra Angel'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const angel = put(g, 'p1', 'Serra Angel', 'battlefield');
    put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Cached Defenses', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(g.state.priority.awaiting, 'one candidate: no question').toBeNull();
    expect(plus(g, bears), 'the Bears bolstered').toBe(3);
    expect(plus(g, angel), 'the Angel untouched').toBe(0);
    expect(bolsters(g)).toBe(1);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Cached Defenses with two Bears: the tie is asked, the Angel refused, the chosen Bears gets the counters; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Cached Defenses', 'Grizzly Bears', 'Grizzly Bears', 'Serra Angel'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const a = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const b = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const angel = put(g, 'p1', 'Serra Angel', 'battlefield');
    const spell = put(g, 'p1', 'Cached Defenses', 'hand');
    main(g, 3);
    mana(g, 'p1', 'GGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    if (ask?.kind !== 'chooseFromZone') throw new Error('no ask');
    expect(ask.player).toBe('p1');
    expect(ask.zone).toBe('battlefield');
    expect(ask.count).toBe(1);
    expect(ask.pick, 'the prompt names the rule, not the candidates').toBe('leastToughness');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [angel] }).ok, 'the Angel is not among the least').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [b] }));
    settle(g);
    expect(plus(g, b)).toBe(3);
    expect(plus(g, a)).toBe(0);
    expect(plus(g, angel)).toBe(0);
    expect(bolsters(g)).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Honor's Reward with no creature: the life is gained and the bolster does nothing, said; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [["Honor's Reward"], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', "Honor's Reward", 'hand');
    main(g, 3);
    const life0 = g.state.players.p1?.life ?? 0;
    mana(g, 'p1', 'WWW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 + 4);
    expect(bolsters(g), 'the queue resolved with nothing chosen').toBe(1);
    expect(g.log.some((e) => e.body.t === 'Narrated' && /no creature to bolster/.test(e.body.text)), 'said').toBe(true);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
