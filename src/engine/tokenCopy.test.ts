// D485 - THE TOKEN COPY (CR 707). `Create a token that's a copy of target creature you control` takes the copied
// object's COPIABLE VALUES - its printing, its face and the copy exceptions it already carries - and nothing of its
// status: counters, damage, tapped-ness stay behind. The token IS that card (its abilities run, its name matches), and
// a clause's own `except ...` rides it as `copyExceptions`, read at layer 1 beside the printing. What is proven here:
// the parser's readings and refusals; Cackling Counterpart's copy of a countered Bears is a plain 2/2 Bears token; a
// copy of Wall of Omens draws (the copied ability fires); Saheeli's Artistry's second mode makes an artifact copy and a
// copy of THAT token is an artifact too (707.3); Rite of Replication kicked makes five; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { WALL_OF_OMENS_SCRIPT } from './scripts/cards/wallOfOmens';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const tokensOf = (g: Game, who: 'p1' | 'p2'): InstanceId[] => g.state.zones.battlefield.filter((id) => g.state.cards[id]?.isToken === true && g.state.cards[id]?.controller === who);
const chars = (g: Game, id: InstanceId) => derive(g.state, deps().oracle, deps().scripts, id);

describe('D485 - the token copy', () => {
  test('the vocabulary reads the copy of a target and of the source, with the closed exceptions, and refuses the rest', () => {
    const a = parseEffects("Create a token that's a copy of target creature you control.", '~', true);
    expect(a.mode).toBe('auto');
    expect(a.effects[0]).toMatchObject({ kind: 'createToken', amount: 1, targetIndex: 0, self: false, token: null, copy: { of: 'target', exceptions: null } });
    const b = parseEffects("Create a token that's a copy of ~, except it has haste and it isn't legendary.", '~', true);
    expect(b.effects[0]).toMatchObject({ kind: 'createToken', self: true, copy: { of: 'self', exceptions: { keywords: ['haste'], notLegendary: true } } });
    const c = parseEffects("Create a token that's a copy of target creature, except it's an artifact in addition to its other types.", '~', true);
    expect(c.effects[0]?.copy?.exceptions).toEqual({ addTypes: ['Artifact'] });
    const d = parseEffects("Create two tokens that are copies of target creature you control, except they're 1/1 Spirit creatures in addition to their other types.", '~', true);
    expect(d.mode).not.toBe('auto');
    const e = parseEffects("Create a token that's a copy of target creature you control, except it's a Spirit in addition to its other types and it's 1/1.", '~', true);
    expect(e.effects[0]?.copy?.exceptions).toEqual({ addSubtypes: ['Spirit'], power: 1, toughness: 1 });
    const f = parseEffects("Exile target creature. Create a token that's a copy of it.", '~', true);
    expect(f.mode).toBe('auto');
    expect(f.effects.map((x) => x.kind)).toEqual(['exile', 'createToken']);
    expect(parseEffects("Create a token that's a copy of target creature you control, except it has this ability.", '~', true).mode).not.toBe('auto');
    expect(parseEffects("Create a tapped and attacking token that's a copy of target creature.", '~', true).mode).not.toBe('auto');
  });

  test('Cackling Counterpart: the copy of a countered Bears is a plain 2/2 Bears token, and the replay agrees', () => {
    const g = startedGame({ players: 2, decks: [['Cackling Counterpart', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
    const spell = put(g, 'p1', 'Cackling Counterpart', 'hand');
    main3(g);
    mana(g, 'p1', 'CUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const tokens = tokensOf(g, 'p1');
    expect(tokens).toHaveLength(1);
    const token = tokens[0] as InstanceId;
    expect(nameOf(g, token)).toBe('Grizzly Bears');
    const c = chars(g, token);
    expect([c.power, c.toughness]).toEqual([2, 2]);
    expect(g.state.cards[token]?.counters).toEqual({});
    expect(g.state.cards[token]?.owner).toBe('p1');
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.body.copyOf === bears)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a copy of Wall of Omens draws: the copied ability fires for the token', () => {
    const g = startedGame({ players: 2, decks: [['Cackling Counterpart', 'Wall of Omens', 'Grizzly Bears', 'Hill Giant'], ['Grizzly Bears']], scripts: createRegistry([WALL_OF_OMENS_SCRIPT]) });
    holdEverywhere(g);
    const wall = put(g, 'p1', 'Wall of Omens');
    const spell = put(g, 'p1', 'Cackling Counterpart', 'hand');
    main3(g);
    const hand0 = (g.state.zones.hand.p1 ?? []).length - 1;
    mana(g, 'p1', 'CUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: wall }] }));
    settle(g);
    expect(tokensOf(g, 'p1')).toHaveLength(1);
    expect((g.state.zones.hand.p1 ?? []).length, 'the token copy entered and drew').toBe(hand0 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Saheeli's Artistry: the artifact-in-addition exception rides the token, and a copy of that token keeps it (707.3)", () => {
    const g = startedGame({ players: 2, decks: [["Saheeli's Artistry", 'Cackling Counterpart', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const artistry = put(g, 'p1', "Saheeli's Artistry", 'hand');
    main3(g);
    mana(g, 'p1', 'CCCCUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: artistry, modes: [1], targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const first = tokensOf(g, 'p1');
    expect(first).toHaveLength(1);
    const copy1 = first[0] as InstanceId;
    expect(chars(g, copy1).typeLine.types).toEqual(['Artifact', 'Creature']);
    expect(g.state.cards[copy1]?.copyExceptions).toEqual({ addTypes: ['Artifact'] });
    const counterpart = put(g, 'p1', 'Cackling Counterpart', 'hand');
    mana(g, 'p1', 'CUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: counterpart, targets: [{ kind: 'card', id: copy1 }] }));
    settle(g);
    const copy2 = tokensOf(g, 'p1').find((id) => id !== copy1) as InstanceId;
    expect(copy2).toBeDefined();
    expect(chars(g, copy2).typeLine.types, 'a copy of a copy copies the exceptions too').toEqual(['Artifact', 'Creature']);
    expect(nameOf(g, copy2)).toBe('Grizzly Bears');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Rite of Replication kicked makes five copies', () => {
    const g = startedGame({ players: 2, decks: [['Rite of Replication', 'Grizzly Bears'], ['Hill Giant']] });
    holdEverywhere(g);
    const giant = put(g, 'p2', 'Hill Giant');
    const rite = put(g, 'p1', 'Rite of Replication', 'hand');
    main3(g);
    mana(g, 'p1', 'CCCCCCCUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rite, kicked: 1, targets: [{ kind: 'card', id: giant }] }));
    settle(g);
    const tokens = tokensOf(g, 'p1');
    expect(tokens).toHaveLength(5);
    for (const t of tokens) expect(nameOf(g, t)).toBe('Hill Giant');
    expect(g.state.cards[giant]?.controller).toBe('p2');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
