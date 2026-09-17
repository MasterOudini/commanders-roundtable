// D484 - THE PROMPT CONTINUATION. An asking effect stops a resolution (the answer is a later intent, D136's shape), and
// everything after it used to be dropped - D195's rule landed every such card `assisted`. Now the question CARRIES the
// clauses after it (`EffectContinuation` on the awaiting) and every answer handler resumes them against the state the
// answer left. What is proven here: the parser reads the shapes whole; Vampiric Tutor's search puts the card on top and
// THEN costs 2 life (a shuffle's RNG before the resume, the replay hash after); Contentious Plan proliferates and then
// draws; Geth's Verdict's player queue ends and the aimed player loses 1 life (with no choice to make, no question and
// the loss lands at once); Mind Ravel's discard arms the delayed draw only when answered; Disrupt's payment runs its
// branch and then draws whichever way p2 answers; Experimental Augury chains a look, its ordering and a proliferate -
// the continuation forwarded across the ordering; Basic Conjuration's random bottom and the life gain replay.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const VERDICT = "Geth's Verdict";
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const hand = (g: Game, who: 'p1' | 'p2') => (g.state.zones.hand[who] ?? []).length;
const carried = (g: Game) => { const a = g.state.priority.awaiting; return a !== null && 'continuation' in a ? a.continuation : undefined; };
const resumed = (g: Game) => g.log.filter((e) => e.body.t === 'ContinuationResumed').length;

describe('D484 - the prompt continuation', () => {
  test('the vocabulary reads an ask before the last sentence whole, and the riders keep riding their spec', () => {
    const tutor = parseEffects('Search your library for a card, then shuffle and put that card on top. You lose 2 life.', '~', true);
    expect(tutor.mode).toBe('auto');
    expect(tutor.effects.map((e) => e.kind)).toEqual(['search', 'loseLife']);
    expect(parseEffects('Proliferate.\nDraw a card.', '~', true).effects.map((e) => e.kind)).toEqual(['proliferate', 'draw']);
    const verdict = parseEffects('Target player sacrifices a creature of their choice and loses 1 life.', '~', true);
    expect(verdict.mode).toBe('auto');
    expect(verdict.effects.map((e) => e.kind)).toEqual(['sacrifice', 'loseLife']);
    expect(parseEffects('Scry 1.\nDestroy target artifact.', '~', true).mode).toBe('auto');
    expect(parseEffects('Each opponent discards a card and loses 2 life.', '~', true).mode).toBe('auto');
    // The scry rider is still one clause, and a payment whose branch asks is still refused.
    expect(parseEffects('Scry 2, then draw a card.', '~', true).effects).toHaveLength(1);
    expect(parseEffects('You may pay {2}. If you do, proliferate.', '~', true).mode).not.toBe('auto');
  });

  test('Vampiric Tutor: the found card goes on top and THEN the life is lost; the shuffle and the replay agree', () => {
    const g = startedGame({ players: 2, decks: [['Vampiric Tutor', 'Grizzly Bears', 'Hill Giant', 'Coral Eel'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const tutor = put(g, 'p1', 'Vampiric Tutor', 'hand');
    main3(g);
    const life0 = life(g, 'p1');
    mana(g, 'p1', 'B');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: tutor, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    expect(carried(g)?.effects.map((e) => e.kind)).toEqual(['loseLife']);
    expect(life(g, 'p1'), 'nothing after the question has run yet').toBe(life0);
    const found = (g.state.zones.library.p1 ?? [])[0] as InstanceId;
    const shuffles = g.log.filter((e) => e.body.t === 'LibraryShuffled').length;
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [found], declined: false }));
    settle(g);
    const after = g.state.zones.library.p1 ?? [];
    expect(after[after.length - 1], 'the tutor puts the card it found on top').toBe(found);
    expect(g.log.filter((e) => e.body.t === 'LibraryShuffled').length).toBe(shuffles + 1);
    expect(resumed(g)).toBe(1);
    expect(life(g, 'p1')).toBe(life0 - 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Contentious Plan: the proliferate is answered, then the draw', () => {
    const g = startedGame({ players: 2, decks: [['Contentious Plan', 'Grizzly Bears', 'Hill Giant', 'Coral Eel'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
    const plan = put(g, 'p1', 'Contentious Plan', 'hand');
    main3(g);
    mana(g, 'p1', 'CU');
    const hand0 = hand(g, 'p1') - 1;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: plan, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'proliferateChoice', 20_000);
    expect(hand(g, 'p1'), 'the draw waits for the answer').toBe(hand0);
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [bears], players: [] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(2);
    expect(hand(g, 'p1')).toBe(hand0 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the edict: the aimed player answers the queue, then loses the life; with no choice, no question and the loss at once', () => {
    const g = startedGame({ players: 2, decks: [[VERDICT, VERDICT], ['Grizzly Bears', 'Hill Giant', 'Coral Eel']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const giant = put(g, 'p2', 'Hill Giant');
    const verdict = put(g, 'p1', VERDICT, 'hand');
    main3(g);
    const life0 = life(g, 'p2');
    mana(g, 'p1', 'BB');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: verdict, targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    expect(life(g, 'p2'), 'the loss waits for the answer').toBe(life0);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [giant] }));
    settle(g);
    expect(g.state.cards[giant]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(life(g, 'p2')).toBe(life0 - 1);
    // One creature left: nothing to choose, no question, and the whole sentence lands in one batch.
    const again = put(g, 'p1', VERDICT, 'hand');
    mana(g, 'p1', 'BB');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: again, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(life(g, 'p2')).toBe(life0 - 2);
    expect(resumed(g)).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Mind Ravel: the discard is answered, then the delayed draw is armed and fires at the next upkeep', () => {
    const g = startedGame({ players: 2, decks: [['Mind Ravel', 'Grizzly Bears', 'Hill Giant', 'Coral Eel', 'Grizzly Bears'], ['Grizzly Bears', 'Hill Giant', 'Coral Eel']] });
    holdEverywhere(g);
    const ravel = put(g, 'p1', 'Mind Ravel', 'hand');
    main3(g);
    put(g, 'p2', 'Hill Giant', 'hand');
    put(g, 'p2', 'Coral Eel', 'hand');
    mana(g, 'p1', 'CCB');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ravel, targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    expect(g.state.delayedTriggers, 'the delayed draw waits for the answer').toHaveLength(0);
    const theirs = [...(g.state.zones.hand.p2 ?? [])];
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [theirs[0] as InstanceId] }));
    settle(g);
    expect(g.state.cards[theirs[0] as InstanceId]?.zone.kind).toBe('graveyard');
    expect(g.state.delayedTriggers).toHaveLength(1);
    const hand0 = hand(g, 'p1');
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'draw', 40_000);
    expect(hand(g, 'p1'), 'the next upkeep drew p1 the card').toBe(hand0 + 1);
    expect(g.state.delayedTriggers).toHaveLength(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  function disrupted(): Game {
    const g = startedGame({ players: 2, decks: [['Disrupt', 'Grizzly Bears', 'Hill Giant'], ['Cruel Edict', 'Grizzly Bears']] });
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
    const edict = put(g, 'p2', 'Cruel Edict', 'hand');
    // p2 can always pay the {1}: declining is a choice, not an empty pool (an unpayable price is not a question, D369).
    mana(g, 'p2', 'CBC');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: edict, targets: [{ kind: 'player', id: 'p1' }] }));
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
    const stackId = g.state.stack.find((o) => o.card === edict)?.id as string;
    const disrupt = put(g, 'p1', 'Disrupt', 'hand');
    mana(g, 'p1', 'U');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: disrupt, targets: [{ kind: 'stack', id: stackId }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    return g;
  }

  test('Disrupt: the payment prompt carries the draw; paying resolves the spell and p1 draws, declining counters it and p1 draws', () => {
    for (const pays of [true, false]) {
      const g = disrupted();
      expect(carried(g)?.effects.map((e) => e.kind)).toEqual(['draw']);
      const hand0 = hand(g, 'p1');
      const edict = Object.keys(g.state.cards).find((id) => g.state.cards[id as InstanceId]?.zone.kind === 'stack' && g.state.cards[id as InstanceId]?.controller === 'p2') as InstanceId;
      must(g.submit({ t: 'AnswerPayMana', player: 'p2', pay: pays }));
      settle(g);
      expect(resumed(g)).toBe(1);
      expect(hand(g, 'p1'), pays ? 'paid: Disrupt still draws' : 'declined: Disrupt counters and draws').toBe(hand0 + 1);
      expect(g.state.cards[edict]?.zone.kind).toBe('graveyard');
      expect(g.log.some((e) => e.body.t === 'SpellCountered'), 'countered only when the price is declined').toBe(!pays);
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });

  test('Experimental Augury: the look, its ordering and the proliferate in a row - the continuation forwarded across the ordering', () => {
    const g = startedGame({ players: 2, decks: [['Experimental Augury', 'Grizzly Bears', 'Hill Giant', 'Coral Eel', 'Grizzly Bears', 'Hill Giant'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
    const augury = put(g, 'p1', 'Experimental Augury', 'hand');
    main3(g);
    mana(g, 'p1', 'CU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: augury, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    expect(carried(g)?.effects.map((e) => e.kind)).toEqual(['proliferate']);
    const shown = (g.state.zones.library.p1 ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(shown).toHaveLength(3);
    const keep = shown[2] as InstanceId;
    const rest = shown.filter((id) => id !== keep);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [keep] }));
    expect(g.state.priority.awaiting?.kind).toBe('orderCards');
    expect(carried(g)?.effects.map((e) => e.kind), 'the ordering carries the proliferate').toEqual(['proliferate']);
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: rest }));
    expect(g.state.priority.awaiting?.kind, 'the continuation asks in its turn').toBe('proliferateChoice');
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [bears], players: [] }));
    settle(g);
    expect(g.state.cards[keep]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(rest.map((id) => g.state.cards[id]?.zone.kind)).toEqual(['library', 'library']);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Basic Conjuration: the random bottom, then the life gain - and the replay lands on the same board', () => {
    const g = startedGame({ players: 2, decks: [['Basic Conjuration', 'Grizzly Bears', 'Hill Giant', 'Coral Eel', 'Grizzly Bears', 'Hill Giant', 'Coral Eel', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const conjuration = put(g, 'p1', 'Basic Conjuration', 'hand');
    main3(g);
    const life0 = life(g, 'p1');
    mana(g, 'p1', 'CGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: conjuration, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const shown = (g.state.zones.library.p1 ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    // The deck is padded with lands: the pick must be one the printed noun admits (a creature card).
    const creature = shown.find((id) => /Bears|Giant|Eel/.test(nameOf(g, id))) as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [creature] }));
    settle(g);
    expect(g.state.cards[creature]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(life(g, 'p1')).toBe(life0 + 3);
    expect(resumed(g)).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
