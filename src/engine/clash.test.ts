// D527 - CLASH (CR 701.10). `Clash with an opponent`: you and the opponent each reveal the top card of your library and
// put it on the top or bottom (two placement prompts, chained); the higher mana value wins, a tie or an empty library
// wins nothing. `If you win, ...` is D523's gate over the verdict, which rides the resolution's continuation; the six
// clash spells that `return ~ to its owner's hand` come back from the graveyard once the answers resume them. With more
// than one opponent the caster is asked which (`choosePlayer`). What is proven here: the parser's readings; the win
// (the placements, the verdict, the spell back in hand); the loss (the spell stays in the graveyard, the gate says why);
// the tie; the three-player choice; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const onTop = (g: Game, who: 'p1' | 'p2' | 'p3', card: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: who, card, to: { kind: 'library', player: who }, placement: 'top' }));
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const untilScry = (g: Game, who: string) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice' && s.priority.awaiting.player === who, 20_000);
const shownTo = (g: Game, who: string) => (g.state.zones.library[who] ?? []).filter((id) => g.state.cards[id]?.revealedTo.includes(who));
const clashed = (g: Game) => g.log.filter((e) => e.body.t === 'Clashed').map((e) => (e.body.t === 'Clashed' ? e.body : null));

/** Research the Deep in hand, four mana floating, the two library tops stacked as named. */
function armed(p1Top: string, p2Top: string): { g: Game; deep: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Research the Deep', 'Grizzly Bears', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest']], options: { maxHandSize: null } });
  holdEverywhere(g);
  const deep = put(g, 'p1', 'Research the Deep', 'hand');
  const mine = put(g, 'p1', p1Top, 'hand');
  const theirs = put(g, 'p2', p2Top, 'hand');
  const drawn = put(g, 'p1', 'Forest', 'hand');
  main(g, 3);
  // The spell draws first: a Forest above the card the clash will reveal.
  onTop(g, 'p1', mine);
  onTop(g, 'p1', drawn);
  onTop(g, 'p2', theirs);
  mana(g, 'p1', 'UUUU');
  return { g, deep, mine, theirs };
}

describe('D527 - clash', () => {
  test('the parser reads the clash, the gated self-return and the rider', () => {
    const deep = faceNamed('Research the Deep');
    expect(deep.effectMode).toBe('auto');
    expect(deep.effects.map((e) => e.kind)).toEqual(['draw', 'clash', 'returnSelf']);
    expect(deep.effects[2]?.gate?.[0]?.kind).toBe('clashWon');
    const ants = faceNamed('Release the Ants');
    expect(ants.effectMode).toBe('auto');
    expect(ants.effects.map((e) => e.kind)).toEqual(['damage', 'clash', 'returnSelf']);
    expect(ants.effects[2]?.gate?.[0]?.kind).toBe('clashWon');
  });

  test('a won clash: two placements, the verdict, and Research the Deep back in hand', () => {
    const { g, deep, mine, theirs } = armed('Grizzly Bears', 'Forest');
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: deep }));
    untilScry(g, 'p1');
    const first = g.state.priority.awaiting;
    expect(first?.kind === 'scryChoice' ? first.clash?.stage : null).toBe('you');
    expect(first?.kind === 'scryChoice' ? first.clash?.yourMv : null).toBe(2);
    expect(shownTo(g, 'p1')).toEqual([mine]);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [mine], toBottom: [] }));
    untilScry(g, 'p2');
    const second = g.state.priority.awaiting;
    expect(second?.kind === 'scryChoice' ? second.clash?.stage : null).toBe('opponent');
    expect(second?.kind === 'scryChoice' ? second.clash?.theirMv : null).toBe(0);
    must(g.submit({ t: 'AnswerScry', player: 'p2', toTop: [], toBottom: [theirs] }));
    settle(g);
    expect(clashed(g)).toEqual([{ t: 'Clashed', player: 'p1', opponent: 'p2', won: true, yourMv: 2, theirMv: 0 }]);
    expect(g.state.cards[deep]?.zone.kind, 'the gated return brought the spell back').toBe('hand');
    expect((g.state.zones.hand.p1 ?? []).length, 'the draw, the spell cast, the spell back').toBe(hand0 - 1 + 1 + 1);
    expect(g.state.zones.library.p2?.[0], 'the opponent put the Forest on the bottom').toBe(theirs);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a lost clash: the gate does nothing and the spell stays in the graveyard', () => {
    const { g, deep, mine, theirs } = armed('Forest', 'Grizzly Bears');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: deep }));
    untilScry(g, 'p1');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [mine], toBottom: [] }));
    untilScry(g, 'p2');
    must(g.submit({ t: 'AnswerScry', player: 'p2', toTop: [theirs], toBottom: [] }));
    settle(g);
    expect(clashed(g).map((c) => c?.won)).toEqual([false]);
    expect(g.state.cards[deep]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'Narrated' && /does nothing: if you win the clash/.test(e.body.text)), 'the gate says why').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a tie wins nothing', () => {
    const { g, deep, mine, theirs } = armed('Forest', 'Forest');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: deep }));
    untilScry(g, 'p1');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [mine], toBottom: [] }));
    untilScry(g, 'p2');
    must(g.submit({ t: 'AnswerScry', player: 'p2', toTop: [theirs], toBottom: [] }));
    settle(g);
    expect(clashed(g).map((c) => c?.won)).toEqual([false]);
    expect(g.state.cards[deep]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('with two opponents the caster chooses which to clash with', () => {
    const g = startedGame({ players: 3, decks: [['Research the Deep', 'Grizzly Bears', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest']], options: { maxHandSize: null } });
    holdEverywhere(g);
    const deep = put(g, 'p1', 'Research the Deep', 'hand');
    const mine = put(g, 'p1', 'Grizzly Bears', 'hand');
    const theirs = put(g, 'p3', 'Grizzly Bears', 'hand');
    const drawn = put(g, 'p1', 'Forest', 'hand');
    main(g, 4);
    onTop(g, 'p1', mine);
    onTop(g, 'p1', drawn);
    onTop(g, 'p3', theirs);
    mana(g, 'p1', 'UUUU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: deep }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'choosePlayer', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'choosePlayer' ? ask.candidates : null).toEqual(['p2', 'p3']);
    expect(g.submit({ t: 'AnswerChoosePlayer', player: 'p1', chosen: 'p1' }).ok, 'not a candidate').toBe(false);
    must(g.submit({ t: 'AnswerChoosePlayer', player: 'p1', chosen: 'p3' }));
    untilScry(g, 'p1');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [mine], toBottom: [] }));
    untilScry(g, 'p3');
    must(g.submit({ t: 'AnswerScry', player: 'p3', toTop: [theirs], toBottom: [] }));
    settle(g);
    expect(clashed(g)).toEqual([{ t: 'Clashed', player: 'p1', opponent: 'p3', won: false, yourMv: 2, theirMv: 2 }]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
