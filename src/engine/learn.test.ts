// D539 - LEARN (CR 701.48a): "You may reveal a Lesson card you own from outside the game and put it into your hand, or
// discard a card to draw a card." The engine models no cards outside the game (Commander deals no sideboard), so learn is
// the rummage or nothing: a whole-line `Learn.` reads as D415's verb price - `You may discard a card. If you do, draw a
// card.` What is proven here: the reading and the card complete; Igneous Inspiration's damage, then the rummage paid (the
// named card discarded, one drawn); declined (nothing moves); an empty hand asking nothing; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const toAsk = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, sym: 'R' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const hand = (g: Game): readonly InstanceId[] => g.state.zones.hand.p1 ?? [];
const P2 = { kind: 'player', id: 'p2' } as const;

function cast(g: Game, card: InstanceId) {
  mana(g, 'R', 1);
  mana(g, 'C', 2);
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [P2] }));
  toAsk(g);
}

describe('D539 - learn', () => {
  test('the reading: learn is the optional rummage, and the card is complete', () => {
    const p = parseEffects('Igneous Inspiration deals 3 damage to any target.\nLearn.', 'Igneous Inspiration', true);
    expect(p.mode).toBe('auto');
    expect(p.effects.map((e) => e.kind)).toEqual(['damage', 'payOptional']);
    expect(parseEffects('learn.', 'Eyetwitch', true).effects.map((e) => e.kind), 'a payload too').toEqual(['payOptional']);
    expect(isEngineComplete(fixture('Igneous Inspiration'))).toBe(true);
  });

  test('the rummage paid: the named card discarded and one drawn, after the damage', () => {
    const g = startedGame({ players: 2, decks: [['Igneous Inspiration', 'Grizzly Bears', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Igneous Inspiration', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    main3(g);
    const life0 = life(g, 'p2');
    const hand0 = hand(g).length;
    cast(g, spell);
    expect(g.state.priority.awaiting?.kind, 'the learn asks').toBe('payMana');
    expect(life(g, 'p2'), 'the damage first').toBe(life0 - 3);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(hand(g).length, 'the spell cast, the Bears discarded, one drawn').toBe(hand0 - 1 - 1 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declined: nothing discarded, nothing drawn', () => {
    const g = startedGame({ players: 2, decks: [['Igneous Inspiration', 'Grizzly Bears', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Igneous Inspiration', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    main3(g);
    const hand0 = hand(g).length;
    cast(g, spell);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(hand(g).length, 'the spell cast, nothing else').toBe(hand0 - 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an empty hand is asked nothing', () => {
    const g = startedGame({ players: 2, decks: [['Igneous Inspiration', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Igneous Inspiration', 'hand');
    main3(g);
    for (const id of [...hand(g)]) if (id !== spell) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' } }));
    cast(g, spell);
    expect(g.state.priority.awaiting, 'no card to discard, no question').toBeNull();
    settle(g);
    expect(hand(g).length).toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
