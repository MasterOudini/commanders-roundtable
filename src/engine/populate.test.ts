// D488 - POPULATE (CR 701.31). `Populate.` - alone, or after `, then` - creates a token that is a copy of a creature
// token its controller controls, the token their choice: the executor folds the batch so far (`Create a token, then
// populate` copies the token this resolution just made), copies a lone candidate at once, does nothing with none, and
// with several asks through the D390 queue's question with its own verb (`chooseFromZone` on the battlefield, the
// noun `creature token you control`) - the answer's copy takes the state's next id, and the clauses after the populate
// ride the question (D484). What is proven here: the parser's readings; Wake the Reflections with no token does
// nothing and asks nothing; Eyes in the Skies makes two Birds, the second a copy of the first; with two Birds Wake the
// Reflections asks, refuses a card, and copies the chosen token; Rootborn Defenses' grant runs after the answer; the
// replay hash on each.
import { describe, expect, test } from 'vitest';
import { TOKEN_TABLE } from '../data/tokenTable';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const asked = (g: Game) => { advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000); const a = g.state.priority.awaiting; if (a?.kind !== 'chooseFromZone') throw new Error('no choice prompt'); return a; };
const tokensOf = (g: Game, who: 'p1' | 'p2') => g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === who && g.state.cards[id]?.isToken === true);
const nameOf = (g: Game, id: InstanceId) => derive(g.state, deps().oracle, deps().scripts, id).name;
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const populated = (g: Game) => g.log.filter((e) => e.body.t === 'Populated').length;
const BIRD = TOKEN_TABLE['Bird|1/1|W|Creature|flying']?.printingId ?? '';

describe('D488 - populate', () => {
  test('the parser reads the bare word, the then-form and the sentence before it', () => {
    expect(faceNamed('Wake the Reflections').effects.map((e) => e.kind)).toEqual(['populate']);
    expect(faceNamed('Wake the Reflections').effectMode).toBe('auto');
    expect(faceNamed('Eyes in the Skies').effects.map((e) => e.kind)).toEqual(['createToken', 'populate']);
    expect(faceNamed('Eyes in the Skies').effectMode).toBe('auto');
    expect(faceNamed('Rootborn Defenses').effects[0]?.kind).toBe('populate');
    expect(faceNamed('Rootborn Defenses').effectMode).toBe('auto');
    expect(faceNamed("Druid's Deliverance").effects.map((e) => e.kind)).toContain('populate');
    expect(faceNamed("Druid's Deliverance").effectMode).toBe('auto');
  });

  test('with no creature token, Wake the Reflections does nothing and asks nothing', () => {
    const g = startedGame({ players: 2, decks: [['Wake the Reflections', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    put(g, 'p1', 'Grizzly Bears');
    const wake = put(g, 'p1', 'Wake the Reflections', 'hand');
    main3(g);
    mana(g, 'p1', 'W');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: wake, targets: [] }));
    settle(g);
    expect(tokensOf(g, 'p1')).toHaveLength(0);
    expect(populated(g)).toBe(0);
    expect(g.state.cards[wake]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Eyes in the Skies makes a Bird and populates it: two Birds, the second a copy of the first', () => {
    const g = startedGame({ players: 2, decks: [['Eyes in the Skies', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const eyes = put(g, 'p1', 'Eyes in the Skies', 'hand');
    main3(g);
    mana(g, 'p1', 'CCCW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: eyes, targets: [] }));
    settle(g);
    const birds = tokensOf(g, 'p1');
    expect(birds).toHaveLength(2);
    expect(birds.map((id) => nameOf(g, id))).toEqual(['Bird', 'Bird']);
    expect(birds.every((id) => derive(g.state, deps().oracle, deps().scripts, id).keywords.has('flying'))).toBe(true);
    const made = g.log.filter((e) => e.body.t === 'TokenCreated');
    expect(made).toHaveLength(2);
    expect(made[1]?.body.t === 'TokenCreated' ? made[1].body.copyOf : null).toBe(birds[0]);
    expect(populated(g)).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('with two tokens the controller is asked; a card is refused; the chosen token is copied', () => {
    const g = startedGame({ players: 2, decks: [['Wake the Reflections', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: BIRD, count: 2 }));
    const wake = put(g, 'p1', 'Wake the Reflections', 'hand');
    main3(g);
    const before = tokensOf(g, 'p1');
    expect(before).toHaveLength(2);
    mana(g, 'p1', 'W');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: wake, targets: [] }));
    const ask = asked(g);
    expect(ask.player).toBe('p1');
    expect(ask.zone).toBe('battlefield');
    expect(ask.count).toBe(1);
    expect(ask.filter?.what).toBe('creature token you control');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }).ok, 'a card is not a token').toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }).ok, 'exactly one').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [before[1] as InstanceId] }));
    settle(g);
    const after = tokensOf(g, 'p1');
    expect(after).toHaveLength(3);
    const made = g.log.filter((e) => e.body.t === 'TokenCreated' && e.body.copyOf !== undefined);
    expect(made).toHaveLength(1);
    expect(made[0]?.body.t === 'TokenCreated' ? made[0].body.copyOf : null).toBe(before[1]);
    expect(populated(g)).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Rootborn Defenses: the grant after the populate runs once the choice is answered', () => {
    const g = startedGame({ players: 2, decks: [['Rootborn Defenses', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: BIRD, count: 2 }));
    const root = put(g, 'p1', 'Rootborn Defenses', 'hand');
    main3(g);
    mana(g, 'p1', 'CCW');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: root, targets: [] }));
    const ask = asked(g);
    expect(derive(g.state, deps().oracle, deps().scripts, bears).keywords.has('indestructible'), 'the grant waits on the answer').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [tokensOf(g, 'p1')[0] as InstanceId] }));
    settle(g);
    expect(ask.continuation).toBeDefined();
    expect(tokensOf(g, 'p1')).toHaveLength(3);
    expect(derive(g.state, deps().oracle, deps().scripts, bears).keywords.has('indestructible')).toBe(true);
    expect(g.log.filter((e) => e.body.t === 'ContinuationResumed')).toHaveLength(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
