// D584 - THE DRAIN GUARD (CR 117.5, 603.3): a triggered ability waits to be put on the stack until a player would
// receive priority - never over a live question. `advance()` drained the pending triggers BEFORE its awaiting check, so
// a targeted trigger went on the stack and raised its chooseTargets OVER the prompt that was up: a resolution's own
// (Grim Affliction's proliferate, lost to the soulshift of the Kami its counter killed), another controller's unanswered
// aim (two Kami of Empty Graves under one Day of Judgment), and the same controller's first aim after an ordering. Each
// test here failed before the guard (the measurement's drain probe, d584/measure584-reflex-drainprobe.log).
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import type { Game } from './game';

const KAMI = 'Kami of Empty Graves';
const URCHIN = 'Bile Urchin';
const main1 = (g: Game) => advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
const firstPrompt = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting !== null, 20_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);

// The soulshifts resolve one at a time; each says yes to its "you may".
function acceptEach(g: Game, count: number): void {
  for (let i = 0; i < count; i++) {
    firstPrompt(g);
    const may = g.state.priority.awaiting;
    if (may?.kind !== 'optionalTrigger') throw new Error('expected the soulshift' + "'" + 's may, got ' + may?.kind);
    must(g.submit({ t: 'AnswerOptionalTrigger', player: may.player, stackId: may.stackId, accept: true }));
  }
  settle(g);
}

describe('D584 - the drain guard: no trigger goes on the stack over a live prompt', () => {
  test('a trigger under a resolution' + "'" + 's prompt waits for the answer - the proliferate is asked, then the soulshift', () => {
    const g = startedGame({ players: 2, decks: [['Grim Affliction'], [KAMI, URCHIN]] });
    const affliction = put(g, 'p1', 'Grim Affliction', 'hand');
    const kami = put(g, 'p2', KAMI);
    const urchin = put(g, 'p2', URCHIN, 'graveyard');
    main1(g);
    holdEverywhere(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: affliction, targets: [{ kind: 'card', id: kami }] }));
    firstPrompt(g);
    expect(g.state.priority.awaiting?.kind, 'the spell' + "'" + 's own question stays up').toBe('proliferateChoice');
    expect(g.state.stack, 'nothing went on the stack over it').toHaveLength(0);
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [], players: [] }));
    firstPrompt(g);
    const aim = g.state.priority.awaiting;
    expect(aim?.kind === 'chooseTargets' && aim.player, 'then the dead Kami' + "'" + 's soulshift is aimed').toBe('p2');
    must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id: urchin }] }));
    acceptEach(g, 1);
    expect(g.state.cards[urchin]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('two controllers' + "'" + ' targeted triggers: the second is put on and asked only after the first is aimed', () => {
    const g = startedGame({ players: 2, decks: [['Day of Judgment', KAMI, URCHIN], [KAMI, URCHIN]] });
    const wrath = put(g, 'p1', 'Day of Judgment', 'hand');
    put(g, 'p1', KAMI);
    put(g, 'p2', KAMI);
    const mine = put(g, 'p1', URCHIN, 'graveyard');
    const theirs = put(g, 'p2', URCHIN, 'graveyard');
    main1(g);
    holdEverywhere(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: wrath, targets: [] }));
    firstPrompt(g);
    const first = g.state.priority.awaiting;
    expect(first?.kind === 'chooseTargets' && first.player, 'the active player' + "'" + 's goes on first (APNAP) and is aimed').toBe('p1');
    expect(g.state.stack).toHaveLength(1);
    expect(g.state.pendingTriggers, 'the other waits, pending').toHaveLength(1);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    firstPrompt(g);
    const second = g.state.priority.awaiting;
    expect(second?.kind === 'chooseTargets' && second.player).toBe('p2');
    must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id: theirs }] }));
    expect(g.state.stack.map((o) => [o.controller, o.targets.length]), 'each aimed, in APNAP order').toEqual([['p1', 1], ['p2', 1]]);
    acceptEach(g, 2);
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[theirs]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('one controller' + "'" + 's two targeted triggers after the ordering: the second aim waits for the first', () => {
    const g = startedGame({ players: 2, decks: [['Day of Judgment', KAMI, KAMI, URCHIN, URCHIN], []] });
    const wrath = put(g, 'p1', 'Day of Judgment', 'hand');
    put(g, 'p1', KAMI);
    put(g, 'p1', KAMI);
    const a = put(g, 'p1', URCHIN, 'graveyard');
    const b = put(g, 'p1', URCHIN, 'graveyard');
    main1(g);
    holdEverywhere(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: wrath, targets: [] }));
    firstPrompt(g);
    const order = g.state.priority.awaiting;
    if (order?.kind !== 'orderTriggers') throw new Error('expected the ordering, got ' + order?.kind);
    must(g.submit({ t: 'OrderTriggers', player: 'p1', order: [...order.triggers] }));
    expect(g.state.priority.awaiting?.kind, 'the first is aimed').toBe('chooseTargets');
    expect(g.state.stack).toHaveLength(1);
    expect(g.state.pendingTriggers, 'the second waits for the first aim').toHaveLength(1);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
    firstPrompt(g);
    expect(g.state.priority.awaiting?.kind, 'then the second').toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: b }] }));
    expect(g.state.stack.map((o) => o.targets.length), 'both aimed').toEqual([1, 1]);
    acceptEach(g, 2);
    expect(g.state.cards[a]?.zone.kind).toBe('hand');
    expect(g.state.cards[b]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
