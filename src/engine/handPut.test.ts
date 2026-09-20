// D508 - THE HAND PUT. `You may put a land card from your hand onto the battlefield (tapped).` / `Put up to two land
// cards from your hand onto the battlefield tapped.` is a question over the chooser's own hand whose picks arrive on
// the battlefield as permanents (`chooseFromZone` with `to: 'battlefield'`): the parser's rule (the look grammar's noun
// and negations; the count exact or `up to` / `any number of`), the executor (nothing admitted asks nothing; a
// mandatory put with no more admitted than it takes moves them unasked; otherwise the prompt with `min` 0 under `you
// may`), the answer handler's hand branch (the picks admitted by the printed noun, the marker, the move, the tap). What
// is proven here: the readings (and the sentences left unread - `tapped and attacking`, `face down`, `for each free
// vote`); Growth Spiral (the draw, then the ask; a Forest put untapped; declined - nothing moves); Swell of Growth with
// no land in hand (the pump lands, nothing is asked); Lessons from Life (three drawn, the Forest put tapped); the replay
// hash on each. A printed activated ability runs only through its row's script (Tier 3 otherwise), so the abilities
// (Sakura-Tribe Scout, Patron of the Moon) are proven by the rows' own suites.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const puts = (g: Game) => g.log.filter((e) => e.body.t === 'PutFromHand').map((e) => (e.body.t === 'PutFromHand' ? e.body.cards.length : 0));
const asks = (g: Game) => g.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone' && e.body.awaiting.to === 'battlefield').length;

describe('D508 - the hand put', () => {
  test('the readings: the may form, the tapped form, the up-to count, the bare card, the negation; and the sentences left unread', () => {
    const one = parseEffects('You may put a land card from your hand onto the battlefield.', '~', true);
    expect(one.mode).toBe('auto');
    expect(one.effects.map((e) => e.kind)).toEqual(['putFromHand']);
    expect(one.effects[0]?.look).toMatchObject({ take: 1, optional: true, to: 'battlefield', rest: 'hand' });
    expect(one.effects[0]?.look?.filter?.what).toBe('land card');
    expect(one.effects[0]?.look?.tapped).toBeUndefined();
    const two = parseEffects('Put up to two land cards from your hand onto the battlefield tapped.', '~', true);
    expect(two.mode).toBe('auto');
    expect(two.effects[0]?.look).toMatchObject({ take: 2, optional: true, to: 'battlefield', tapped: true });
    const creature = parseEffects('Draw a card. You may put a creature card from your hand onto the battlefield.', '~', true);
    expect(creature.mode).toBe('auto');
    expect(creature.effects.map((e) => e.kind)).toEqual(['draw', 'putFromHand']);
    expect(creature.effects[1]?.look?.filter?.what).toBe('creature card');
    const any = parseEffects('Put any number of creature cards from your hand onto the battlefield.', '~', true);
    expect(any.mode).toBe('auto');
    expect(any.effects[0]?.look).toMatchObject({ take: 99, optional: true });
    const bare = parseEffects('You may put a card from your hand onto the battlefield.', '~', true);
    expect(bare.mode).toBe('auto');
    expect(bare.effects[0]?.look?.filter).toBeNull();
    const non = parseEffects('You may put a nonland card from your hand onto the battlefield.', '~', true);
    expect(non.mode).toBe('auto');
    expect(non.effects[0]?.look?.none).toEqual(['Land']);
    expect(non.effects[0]?.look?.filter).toBeNull();
    const mandatory = parseEffects('Put a creature card from your hand onto the battlefield.', '~', true);
    expect(mandatory.effects[0]?.look?.optional).toBe(false);
    for (const unread of [
      'You may put a creature card from your hand onto the battlefield tapped and attacking.',
      'Put a card from your hand onto the battlefield face down.',
      'You may put a creature card from your hand onto the battlefield for each free vote.',
      'You may put X land cards from your hand onto the battlefield.',
      'Put up to two non-Saga permanent cards from your hand onto the battlefield.',
    ]) expect(parseEffects(unread, '~', true).mode, unread).not.toBe('auto');
  });

  test("Growth Spiral: the draw, then the ask over p1's hand; the Forest put arrives untapped and the marker counts it; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Growth Spiral', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Growth Spiral', 'hand');
    const forest = put(g, 'p1', 'Forest', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    main(g, 3);
    const handBefore = (g.state.zones.hand.p1 ?? []).length;
    const boardBefore = g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === 'p1').length;
    mana(g, 'p1', 'GU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseFromZone');
    if (ask?.kind !== 'chooseFromZone') throw new Error('no ask');
    expect(ask.player).toBe('p1');
    expect(ask.zone).toBe('hand');
    expect(ask.to).toBe('battlefield');
    expect(ask.min, 'you may: the answer may be empty').toBe(0);
    expect(ask.count).toBe(1);
    expect(ask.filter?.what).toBe('land card');
    expect((g.state.zones.hand.p1 ?? []).length, 'the draw came before the ask').toBe(handBefore - 1 + 1);
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }).ok, 'a creature is not a land card').toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }));
    settle(g);
    expect(g.state.cards[forest]?.zone).toEqual({ kind: 'battlefield', player: 'p1' });
    expect(g.state.cards[forest]?.tapped, 'untapped - the line says nothing about tapped').toBe(false);
    expect(g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === 'p1').length).toBe(boardBefore + 1);
    expect(puts(g), 'one put of one card').toEqual([1]);
    expect(asks(g)).toBe(1);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Growth Spiral declined: nothing moves, nothing is asked twice; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Growth Spiral'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Growth Spiral', 'hand');
    const forest = put(g, 'p1', 'Forest', 'hand');
    main(g, 3);
    const boardBefore = g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === 'p1').length;
    mana(g, 'p1', 'GU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    settle(g);
    expect(g.state.cards[forest]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === 'p1').length).toBe(boardBefore);
    expect(puts(g)).toEqual([]);
    expect(asks(g)).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Swell of Growth with no land in hand: the pump lands and nothing is asked - a question with no legal answer is not raised; the replay hash", () => {
    const g = startedGame({ players: 2, decks: [['Swell of Growth', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'battlefield');
    const spell = put(g, 'p1', 'Swell of Growth', 'hand');
    main(g, 3);
    // Every land leaves p1's hand (after the draws): the put finds nothing it admits.
    for (const id of [...(g.state.zones.hand.p1 ?? [])]) {
      if (/^(?:Forest|Island|Mountain|Plains|Swamp)$/.test(nameOf(g, id))) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' } }));
    }
    expect((g.state.zones.hand.p1 ?? []).some((id) => /^(?:Forest|Island|Mountain|Plains|Swamp)$/.test(nameOf(g, id))), 'no land in hand').toBe(false);
    mana(g, 'p1', 'GG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(asks(g), 'nothing admitted: no question').toBe(0);
    // D509 - the clause names itself with an empty marker (nothing put), so the fuzz can tell a clause that ran from one that never did.
    expect(puts(g), 'the clause ran and put nothing').toEqual([0]);
    expect(g.state.cards[spell]?.zone.kind, 'the spell resolved').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Lessons from Life: three drawn, then the ask; the Forest put arrives tapped; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Lessons from Life'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Lessons from Life', 'hand');
    const forest = put(g, 'p1', 'Forest', 'hand');
    main(g, 3);
    const handBefore = (g.state.zones.hand.p1 ?? []).length;
    mana(g, 'p1', 'GGGU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    if (ask?.kind !== 'chooseFromZone') throw new Error('no ask');
    expect(ask.to).toBe('battlefield');
    expect(ask.tapped).toBe(true);
    expect(ask.count).toBe(1);
    expect(ask.min).toBe(0);
    expect((g.state.zones.hand.p1 ?? []).length, 'three drawn before the ask').toBe(handBefore - 1 + 3);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }));
    settle(g);
    expect(g.state.cards[forest]?.zone).toEqual({ kind: 'battlefield', player: 'p1' });
    expect(g.state.cards[forest]?.tapped, 'entered tapped').toBe(true);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(handBefore - 1 + 3 - 1);
    expect(puts(g)).toEqual([1]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
