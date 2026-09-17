// D489 - SUSPEND (CR 702.62) and the FREE CAST from exile. `Suspend N—{cost}`: a special action from the hand any time
// the card could be cast - the cost paid, the card exiled with N time counters (`CardInstance.suspended`); at each of
// its owner's upkeeps a delayed trigger (armed for the owner's next upkeep, re-armed while counters remain) removes
// one, and with the last gone the card is CAST without paying its mana cost: a spell object goes on from exile with
// nothing paid (`alternativePaid`, `suspended`), and the permanent it becomes has haste while it stays
// (`suspendHaste`). What is proven here: the parser's reading; the special action's timing and price; the ticks and
// the free cast; the haste; a suspended card that left exile another way ends the ticks; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const chars = (g: Game, id: InstanceId) => derive(g.state, deps().oracle, deps().scripts, id);
const suspendCasts = (g: Game) => g.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.suspended === true).length;

describe('D489 - suspend', () => {
  test('the parser reads the keyword line', () => {
    expect(faceNamed('Rift Sower').suspend).toMatchObject({ count: 2, cost: { raw: '{G}' } });
    expect(faceNamed('Lotus Bloom').suspend).toMatchObject({ count: 3, cost: { raw: '{0}' } });
    expect(faceNamed('Keldon Halberdier').suspend).toMatchObject({ count: 4, cost: { raw: '{R}' } });
    expect(faceNamed('Grizzly Bears').suspend).toBeNull();
  });

  test('a suspended Rift Sower ticks at each of its owner upkeeps and is cast free with haste after the last', () => {
    const g = startedGame({ players: 2, decks: [['Rift Sower', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const sower = put(g, 'p1', 'Rift Sower', 'hand');
    main(g, 3);
    expect(g.submit({ t: 'Suspend', player: 'p1', card: sower }).ok, 'no green mana').toBe(false);
    mana(g, 'p1', 'G');
    must(g.submit({ t: 'Suspend', player: 'p1', card: sower }));
    expect(g.state.cards[sower]?.zone.kind).toBe('exile');
    expect(g.state.cards[sower]?.suspended).toBe(true);
    expect(g.state.cards[sower]?.counters['time']).toBe(2);
    expect(g.state.delayedTriggers.some((d) => d.source === sower)).toBe(true);
    main(g, 5);
    expect(g.state.cards[sower]?.zone.kind).toBe('exile');
    expect(g.state.cards[sower]?.counters['time']).toBe(1);
    expect(suspendCasts(g)).toBe(0);
    main(g, 7);
    expect(suspendCasts(g)).toBe(1);
    expect(g.state.cards[sower]?.zone.kind, 'cast without paying and resolved').toBe('battlefield');
    expect(g.state.cards[sower]?.suspended).toBeUndefined();
    expect(g.state.cards[sower]?.suspendHaste).toBe(true);
    expect(chars(g, sower).keywords.has('haste')).toBe(true);
    expect(g.state.delayedTriggers.some((d) => d.source === sower), 'no tick left armed').toBe(false);
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.suspended === true);
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.castFrom?.kind : null).toBe('exile');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.alternativePaid : null).toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: sower, to: { kind: 'hand', player: 'p1' } }));
    expect(g.state.cards[sower]?.suspendHaste, 'the haste leaves with the permanent').toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the timing is the cast timing: a creature is not suspended on the opponent turn, nor with a spell on the stack', () => {
    const g = startedGame({ players: 2, decks: [['Rift Sower', 'Grizzly Bears'], ['Grizzly Bears', 'Lightning Bolt']] });
    holdEverywhere(g);
    const sower = put(g, 'p1', 'Rift Sower', 'hand');
    const bolt = put(g, 'p2', 'Lightning Bolt', 'hand');
    main(g, 4, 'p2');
    mana(g, 'p1', 'G');
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    expect(g.state.priority.player).toBe('p1');
    expect(g.submit({ t: 'Suspend', player: 'p1', card: sower }).ok, 'sorcery speed: not on the opponent turn').toBe(false);
    main(g, 5);
    must(g.submit({ t: 'PassPriority', player: 'p1' }));
    mana(g, 'p2', 'R');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'player', id: 'p1' }] }));
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    expect(g.state.priority.player).toBe('p1');
    expect(g.state.stack).toHaveLength(1);
    expect(g.submit({ t: 'Suspend', player: 'p1', card: sower }).ok, 'sorcery speed: not with a spell on the stack').toBe(false);
    advanceUntil(g, (s) => s.stack.length === 0 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    mana(g, 'p1', 'G');
    must(g.submit({ t: 'Suspend', player: 'p1', card: sower }));
    expect(g.state.cards[sower]?.zone.kind).toBe('exile');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a suspended card that leaves exile another way is not cast, and the ticks end', () => {
    const g = startedGame({ players: 2, decks: [['Rift Sower', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const sower = put(g, 'p1', 'Rift Sower', 'hand');
    main(g, 3);
    mana(g, 'p1', 'G');
    must(g.submit({ t: 'Suspend', player: 'p1', card: sower }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: sower, to: { kind: 'hand', player: 'p1' } }));
    expect(g.state.cards[sower]?.suspended).toBeUndefined();
    main(g, 7);
    expect(suspendCasts(g)).toBe(0);
    expect(g.state.cards[sower]?.zone.kind).toBe('hand');
    expect(g.state.delayedTriggers.some((d) => d.source === sower)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
