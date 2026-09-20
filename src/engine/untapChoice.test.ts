// D510 - THE UNTAP CHOICE. `Untap up to N lands.` (Frantic Search, Snap, Rewind, Peregrine Drake, Cloud of Faeries) is
// the queue's fifth verb (`untap`, D390's shape): the caster alone is asked to choose up to N permanents the noun
// admits - any controller's (CR: any lands), an untapped pick a legal no-op - and they untap; the prompt carries `min` 0
// (an `up to`), and a board with no more than N candidates goes whole and unasked (the queue's rule). What is proven
// here: the readings (the count, the noun, the `You untap` form; `you control` left unread); Snap on p2's Bears with
// four tapped lands (the bounce, then the ask with `min` 0 and the land filter; two chosen untap, the rest stay; a
// creature refused); Snap declined (nothing untaps); Frantic Search's two-step (the discard first, then the untap ask);
// the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const kinds = (text: string) => { const p = parseEffects(text, '~', true); return { mode: p.mode, effects: p.effects.map((e) => ({ kind: e.kind, amount: e.amount, what: e.untapChoose?.what })) }; };
const lands = (g: Game, who: 'p1' | 'p2') => g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === who && /^(?:Forest|Island|Mountain|Plains|Swamp)$/.test(nameOf(g, c)));
const tapAll = (g: Game, who: 'p1' | 'p2', ids: readonly InstanceId[]) => { must(g.submit({ t: 'ManualSetTapped', player: who, cards: [...ids], tapped: true })); };

describe('D510 - the untap choice', () => {
  test('the readings: the count and the noun, the You form; the you-control form stays unread', () => {
    expect(kinds('Untap up to four lands.')).toEqual({ mode: 'auto', effects: [{ kind: 'untapChoose', amount: 4, what: 'land' }] });
    expect(kinds('Return target creature to its owner\'s hand. Untap up to two lands.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'bounce' }, { kind: 'untapChoose', amount: 2, what: 'land' }] });
    expect(kinds('You untap up to six lands.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'untapChoose', amount: 6 }] });
    expect(kinds('Untap up to two creatures.')).toMatchObject({ mode: 'auto', effects: [{ kind: 'untapChoose', amount: 2, what: 'creature' }] });
    expect(kinds('Untap up to two lands you control.').mode, 'the you-control form is not this shape').not.toBe('auto');
  });

  test("Snap on p2's Bears with four tapped lands: the bounce, then the ask (min 0, the land filter); two chosen untap, the rest stay; a creature refused; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Snap', 'Forest', 'Forest', 'Forest', 'Forest', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    for (let i = 0; i < 4; i++) put(g, 'p1', 'Forest', 'battlefield');
    const myBears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Snap', 'hand');
    main(g, 3);
    const mine = lands(g, 'p1');
    expect(mine.length).toBeGreaterThanOrEqual(4);
    tapAll(g, 'p1', mine);
    mana(g, 'p1', 'UU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    if (ask?.kind !== 'chooseFromZone') throw new Error('no ask');
    expect(ask.player).toBe('p1');
    expect(ask.zone).toBe('battlefield');
    expect(ask.count).toBe(2);
    expect(ask.min, 'up to: the answer may be empty').toBe(0);
    expect(ask.filter?.what).toBe('land');
    expect(g.state.cards[bears]?.zone, 'the bounce came before the ask').toEqual({ kind: 'hand', player: 'p2' });
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [myBears] }).ok, 'a creature is not a land').toBe(false);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [mine[0] as InstanceId, mine[1] as InstanceId, mine[2] as InstanceId] }).ok, 'three is more than two').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [mine[0] as InstanceId, mine[1] as InstanceId] }));
    settle(g);
    expect(g.state.cards[mine[0] as InstanceId]?.tapped).toBe(false);
    expect(g.state.cards[mine[1] as InstanceId]?.tapped).toBe(false);
    expect(g.state.cards[mine[2] as InstanceId]?.tapped, 'the third stays tapped').toBe(true);
    expect(g.state.cards[mine[3] as InstanceId]?.tapped).toBe(true);
    expect(g.log.filter((e) => e.body.t === 'AsksResolved' && e.body.verb === 'untap')).toHaveLength(1);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Snap declined: nothing untaps; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Snap', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears']] });
    holdEverywhere(g);
    for (let i = 0; i < 3; i++) put(g, 'p1', 'Forest', 'battlefield');
    const bears = put(g, 'p2', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Snap', 'hand');
    main(g, 3);
    const mine = lands(g, 'p1');
    tapAll(g, 'p1', mine);
    mana(g, 'p1', 'UU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    settle(g);
    for (const id of mine) expect(g.state.cards[id]?.tapped).toBe(true);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Frantic Search: the draw and the discard first, then the untap ask over three lands; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Frantic Search', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears']] });
    holdEverywhere(g);
    for (let i = 0; i < 4; i++) put(g, 'p1', 'Forest', 'battlefield');
    const spell = put(g, 'p1', 'Frantic Search', 'hand');
    main(g, 3);
    const mine = lands(g, 'p1');
    tapAll(g, 'p1', mine);
    mana(g, 'p1', 'UUU');
    const handBefore = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const first = g.state.priority.awaiting;
    if (first?.kind !== 'chooseFromZone') throw new Error('no discard ask');
    expect(first.zone, 'the discard is asked first').toBe('hand');
    expect(first.count).toBe(2);
    const held = g.state.zones.hand.p1 ?? [];
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [held[0] as InstanceId, held[1] as InstanceId] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.zone === 'battlefield', 20_000);
    const second = g.state.priority.awaiting;
    if (second?.kind !== 'chooseFromZone') throw new Error('no untap ask');
    expect(second.zone).toBe('battlefield');
    expect(second.count).toBe(3);
    expect(second.min).toBe(0);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: mine.slice(0, 3) }));
    settle(g);
    expect(mine.slice(0, 3).every((id) => g.state.cards[id]?.tapped === false)).toBe(true);
    expect(g.state.cards[mine[3] as InstanceId]?.tapped).toBe(true);
    expect((g.state.zones.hand.p1 ?? []).length, 'two drawn, two discarded, the spell gone').toBe(handBefore - 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
