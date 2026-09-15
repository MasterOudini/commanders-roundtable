// D440 - THE KEYWORD TRIGGERS, PART 3: extort (a pay prompt with the drain rider as its body), modular (entry counters
// as a built-in, the dying counters memoised onto the stack object and put on target artifact creature) - and the
// scavenge seam beside them (an activated ability from the graveyard, synthesized like cycling, its counters the card's
// printed power).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { legalActions } from './legal';
import { NO_SCRIPTS } from './scripts/registryCore';
import { parseFace } from '../data/oracleParse';
import { unaccountedLines } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
/** p1 holds the named cards on the battlefield from turn 1 (`hand` names wait in hand); the walk stops at p1's third-turn main. */
function armed(board: readonly string[], hand: readonly string[] = [], p2: readonly string[] = ['Grizzly Bears']): { g: Game; ids: InstanceId[]; held: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[...board, ...hand, ...TEN], [...p2, ...TEN]], scripts: createRegistry([]) });
  advanceUntil(g, (x) => x.stack.length === 0 && x.pendingTriggers.length === 0 && x.priority.awaiting === null, 20_000);
  holdEverywhere(g);
  const ids = board.map((n) => put(g, 'p1', n));
  const held = hand.map((n) => put(g, 'p1', n, 'hand'));
  advanceUntil(g, (x) => x.turn.turnNumber === 3 && x.turn.phase === 'precombatMain' && x.priority.player === 'p1' && x.priority.awaiting === null, 20_000);
  return { g, ids, held };
}
const settle = (g: Game): void => advanceUntil(g, (x) => x.stack.length === 0 && x.pendingTriggers.length === 0 && x.priority.awaiting === null, 20_000);
const mana = (g: Game, symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
const counters = (g: Game, id: InstanceId): number => g.state.cards[id]?.counters['+1/+1'] ?? 0;
const face = (name: string) => {
  const card = ENGINE_CARDS.find((c) => c.name === name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  return { card, parsed: parseFace(card, 0) };
};

describe('the keyword triggers, part 3 (D440)', () => {
  test('extort: casting a spell asks for {W/B}; paid, each opponent loses 1 and the caster gains 1; declined, nothing', () => {
    const { g, held } = armed(['Syndic of Tithes'], ['Grizzly Bears', 'Grizzly Bears']);
    const [first, second] = held as [InstanceId, InstanceId];
    mana(g, 'G', 2); mana(g, 'W', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: first }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'payMana') throw new Error('expected the extort prompt');
    expect(a.label).toContain('extort');
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.players['p1']?.life).toBe(41);
    // The second cast: declined, no life moves; the Bears still resolves.
    mana(g, 'G', 2); mana(g, 'W', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: second }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[second]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('extort with no mana to pay is no question: the spell resolves, nobody loses life', () => {
    const { g, held } = armed(['Syndic of Tithes'], ['Grizzly Bears']);
    mana(g, 'G', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: held[0] as InstanceId }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'payMana')).toBe(false);
    expect(g.state.players['p2']?.life).toBe(40);
    expect(g.state.cards[held[0] as InstanceId]?.zone.kind).toBe('battlefield');
  });

  test('modular: enters with N +1/+1 counters; dying, they may go to target artifact creature', () => {
    const { g, ids } = armed(['Arcbound Bruiser', 'Arcbound Worker']);
    const [bruiser, worker] = ids as [InstanceId, InstanceId];
    expect(counters(g, bruiser)).toBe(3);
    expect(counters(g, worker)).toBe(1);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bruiser, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: worker }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const awaiting = g.state.priority.awaiting;
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('no optional prompt');
    expect(awaiting.label).toContain('modular 3');
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept: true }));
    settle(g);
    expect(counters(g, worker)).toBe(4);
    expect(g.state.cards[bruiser]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('modular declined moves nothing; a Bears is no artifact creature to aim at', () => {
    const { g, ids } = armed(['Arcbound Worker', 'Arcbound Bruiser']);
    const [worker, bruiser] = ids as [InstanceId, InstanceId];
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: worker, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const bears = g.state.zones.battlefield.find((id) => g.state.cards[id]?.controller === 'p2') as InstanceId;
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bruiser }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const awaiting = g.state.priority.awaiting;
    if (awaiting?.kind !== 'optionalTrigger') throw new Error('no optional prompt');
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept: false }));
    settle(g);
    expect(counters(g, bruiser)).toBe(3);
  });

  test('scavenge: from the graveyard, for its mana and its own exile, the printed power in counters on target creature', () => {
    const { g, ids } = armed(['Grizzly Bears'], ['Deadbridge Goliath']);
    const bears = ids[0] as InstanceId;
    const goliath = put(g, 'p1', 'Deadbridge Goliath', 'graveyard');
    const parsed = face('Deadbridge Goliath').parsed;
    const idx = parsed.activated.findIndex((a) => a.scavenge !== undefined);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(parsed.activated[idx]?.scavenge?.power).toBe(5);
    mana(g, 'G', 6);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: goliath, abilityIndex: idx, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[goliath]?.zone.kind).toBe('exile');
    expect(counters(g, bears)).toBe(5);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('scavenge is offered from the graveyard at sorcery speed and nowhere else; the accounting claims the three lines', () => {
    const { g } = armed(['Grizzly Bears'], ['Sewer Shambler']);
    const shambler = put(g, 'p1', 'Sewer Shambler', 'graveyard');
    const idx = face('Sewer Shambler').parsed.activated.findIndex((a) => a.scavenge !== undefined);
    mana(g, 'B', 3);
    const legal = legalActions(g.state, ORACLE, NO_SCRIPTS, 'p1');
    expect(legal.some((x) => x.t === 'ActivateAbility' && x.card === shambler && x.abilityIndex === idx)).toBe(true);
    // From the hand it is not an ability at all.
    const held = put(g, 'p1', 'Sewer Shambler', 'hand');
    void held;
    expect(legalActions(g.state, ORACLE, NO_SCRIPTS, 'p1').filter((x) => x.t === 'ActivateAbility' && x.abilityIndex === idx).every((x) => x.t === 'ActivateAbility' && x.card === shambler)).toBe(true);
    for (const name of ['Syndic of Tithes', 'Arcbound Worker', 'Deadbridge Goliath']) expect(unaccountedLines(face(name).card, 0)).toEqual([]);
    expect(face('Syndic of Tithes').parsed.keywords).toContain('extort');
    expect(face('Arcbound Bruiser').parsed.keywords).toContain('modular');
  });
});
