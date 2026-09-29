// Copy to src/engine/. D587 - A GRANTED CAST'S ELECTIONS TAKE THE BOARD'S REDUCTIONS (FIX-LIST 10 - the review's freecast
// FC-2). Cast "without paying its mana cost" (an alternative cost, CR 118.9), a spell's total cost is what its additional
// costs add (CR 118.9d), and cost reductions apply to that total (CR 601.2f) - to its generic part, never below {0}. The
// ward its targets meet is a triggered ability's price, not the spell's cost (charged beside it here, D68), so no reduction
// reaches it. What is proven here: Helm of Awakening (`Spells cost {1} less to cast.`) takes {1} off a granted Burst
// Lightning's {4} kicker - three floating pay it, at the targets stage too (the staged cast carries the reduction as its
// tax); Helm and Jace's Sanctum (two off an instant) take only the {1} of Into the Roil's {1}{U} kicker, and the Admirer's
// ward {2} is paid whole; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { poolTotal } from './types/mana';
import type { Game } from './game';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';
import type { TargetChoice } from './types/state';

const FORESTS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const onTop = (g: Game, card: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null && s.pendingCast === null, 20_000);
const grant = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.castFree === true, 20_000);
const pool = (g: Game) => poolTotal(g.state.players.p1?.pool ?? { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind ?? 'gone';
const castOf = (g: Game, card: InstanceId, from = 0) => g.log.slice(from).map((e) => e.body).find((b): b is Extract<EventBody, { t: 'SpellCast' }> => b.t === 'SpellCast' && b.obj.card === card);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const P2: TargetChoice = { kind: 'player', id: 'p2' };
const card = (id: InstanceId): TargetChoice => ({ kind: 'card', id });

/**
 * Bloodbraid Elf cast out of {R}{R}{G}{G} with `candidate` under a Forest on top of the library, `mine` and `theirs` on the
 * battlefield: cascade's chooser is up, offering the candidate for free. The Helm cuts the Elf to {1}{R}{G}: one floats.
 */
function cascaded(candidate: string, mine: readonly string[] = [], theirs: readonly string[] = []) {
  const g = startedGame({ players: 2, decks: [['Bloodbraid Elf', candidate, 'Forest', ...mine, ...FORESTS], ['Grizzly Bears', ...theirs, ...FORESTS]], options: { maxHandSize: null } });
  holdEverywhere(g);
  const elf = put(g, 'p1', 'Bloodbraid Elf', 'hand');
  const pick = put(g, 'p1', candidate, 'hand');
  const forest = put(g, 'p1', 'Forest', 'hand');
  const ours = mine.map((name) => put(g, 'p1', name));
  const foes = theirs.map((name) => put(g, 'p2', name));
  main(g, 3);
  onTop(g, pick);
  onTop(g, forest);
  mana(g, 'RRGG');
  must(g.submit({ t: 'CastSpell', player: 'p1', card: elf }));
  grant(g);
  const aw = g.state.priority.awaiting;
  expect(aw?.kind === 'chooseFromZone' ? aw.pool : null, 'cascade offers the candidate').toEqual([pick]);
  return { g, pick, ours, foes };
}

describe("D587 - a granted cast's elections take the board's reductions (CR 601.2f / 118.9d)", () => {
  test("Helm of Awakening takes {1} off a granted Burst Lightning's kicker: {4} less {1}, three floating pay it", () => {
    const { g, pick: burst } = cascaded('Burst Lightning', ['Helm of Awakening']);
    mana(g, 'CC');
    expect(pool(g), "the Elf's leftover and two more").toBe(3);
    const p2 = life(g, 'p2');
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [burst], cast: { kicked: 1 } }));
    expect(g.state.pendingCast?.taxApplied, 'the staged cast carries the reduction its kick took').toBe(-1);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [P2] }));
    settle(g);
    expect(castOf(g, burst, n0)?.obj, 'free, and kicked').toMatchObject({ freeCast: true, kicked: 1 });
    expect(pool(g), 'three paid for the kick').toBe(0);
    expect(life(g, 'p2'), 'kicked: 4, not 2').toBe(p2 - 4);
    hashHolds(g);
  });

  test("the reduction stops at the kick's own generic: Helm and Jace's Sanctum take {1} off Into the Roil's {1}{U}, never the Admirer's ward {2}", () => {
    const { g, pick: roil, foes } = cascaded('Into the Roil', ['Helm of Awakening', "Jace's Sanctum"], ['Toadstool Admirer']);
    const [admirer] = foes as [InstanceId];
    mana(g, 'UC');
    expect(pool(g), "the Elf's leftover, a {U} and a {C}").toBe(3);
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [roil], cast: { kicked: 1 } }));
    // The kick is {U} - its {1} taken off, the second reduction finding no generic left - and the ward {2} stays whole.
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(admirer)] }));
    settle(g);
    expect(castOf(g, roil, n0)?.obj, 'free, and kicked').toMatchObject({ freeCast: true, kicked: 1 });
    expect(pool(g), 'all three paid: a reduction that reached the ward would have left one').toBe(0);
    expect(zoneOf(g, admirer), "bounced to its owner's hand").toBe('hand');
    hashHolds(g);
  });
});
