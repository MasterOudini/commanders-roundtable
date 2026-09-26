// D555 - SUSPECT (CR 701.60): "A suspected creature has menace and can't block." A vocabulary effect (`Suspect
// <target>.`, counted forms included; the self form `suspect ~.`; `Suspect it.` after a clause that found its object),
// a mark on the card (`suspected`) that lasts until the permanent leaves, read by derive (menace, at the layer awaken's
// haste is read) and by canBlock ('suspected'). What is proven here: the reading and Reasonable Doubt complete; the
// Doubt counters the Bears spell its controller declined to pay for and suspects the Hill Giant - menace derived, a
// block by one creature refused, the Giant refused as a blocker on the next turn; Caught Red-Handed suspects the
// creature it took (the object verb after a control change) and the mark outlasts the control; a suspected creature
// that leaves and returns is a new object; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';

const LANDS = ['Island', 'Island', 'Island', 'Island', 'Forest', 'Forest', 'Forest', 'Forest'];
const main = (g: Game, turn: number, who: PlayerId = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, who: PlayerId, sym: 'U' | 'R' | 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: sym, amount: n }));
const at = (id: PlayerId) => ({ kind: 'player', id }) as const;
const zone = (g: Game, id: InstanceId): string => g.state.cards[id]?.zone.kind ?? 'gone';
const menace = (g: Game, id: InstanceId) => derive(g.state, g.deps.oracle, g.deps.scripts, id).keywords.has('menace');

/** p1 (two Forests up) casts Grizzly Bears and passes; p2 answers with Reasonable Doubt aimed at the Bears spell and `creature`; p1 declines the {2}. */
function doubted(g: Game, creature: InstanceId): InstanceId {
  // Two untapped Forests: a controller who could pay is asked (one who could not is not).
  put(g, 'p1', 'Forest'); put(g, 'p1', 'Forest');
  settle(g);
  const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
  mana(g, 'p1', 'G', 2);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
  must(g.submit({ t: 'PassPriority', player: 'p1' }));
  const top = g.state.stack[g.state.stack.length - 1]?.id as string;
  const doubt = put(g, 'p2', 'Reasonable Doubt', 'hand');
  mana(g, 'p2', 'U', 2);
  must(g.submit({ t: 'CastSpell', player: 'p2', card: doubt, targets: [{ kind: 'stack', id: top }, { kind: 'card', id: creature }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
  expect(g.state.priority.awaiting?.kind === 'payMana' ? g.state.priority.awaiting.player : null, "the spell's controller is asked").toBe('p1');
  must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
  settle(g);
  return bears;
}

describe('D555 - suspect', () => {
  test('the reading: a suspect clause per target and the self form; Reasonable Doubt completes', () => {
    expect(faceNamed('Reasonable Doubt').effects.map((e) => e.kind)).toEqual(['payOptional', 'suspect']);
    for (const name of ['Reasonable Doubt', 'Caught Red-Handed']) expect(isEngineComplete(fixture(name)), name).toBe(true);
    expect(faceNamed('Caught Red-Handed').effects.at(-1)?.kind).toBe('suspect');
    expect(parseEffects('Suspect target creature an opponent controls.', 'Probe', true).effects.map((e) => e.kind)).toEqual(['suspect']);
    expect(parseEffects('Suspect Probe.', 'Probe', true).effects.map((e) => [e.kind, e.self])).toEqual([['suspect', true]]);
  });

  test("Reasonable Doubt: the declined Bears countered, the Giant suspected - menace, and it can't block", () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Hill Giant', 'Llanowar Elves', ...LANDS], ['Reasonable Doubt', 'Grizzly Bears', 'Llanowar Elves', ...LANDS]] });
    holdEverywhere(g);
    const giant = put(g, 'p1', 'Hill Giant');
    // An unsuspected blocker keeps p1's declare-blockers prompt (with the Giant alone suspected, there is no block to ask).
    put(g, 'p1', 'Llanowar Elves');
    const theirs = put(g, 'p2', 'Grizzly Bears');
    const elves = put(g, 'p2', 'Llanowar Elves');
    main(g, 3);
    expect(menace(g, giant)).toBe(false);
    const bears = doubted(g, giant);
    expect(zone(g, bears), 'declined: countered').toBe('graveyard');
    expect(g.state.cards[giant]?.suspected).toBe(true);
    expect(menace(g, giant), 'a suspected creature has menace').toBe(true);
    // p1 attacks with the Giant: one blocker is refused (menace); none is fine.
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p1', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: giant, defender: at('p2') }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    expect(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: theirs, attacker: giant }] }).ok, 'menace: one blocker is not enough').toBe(false);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [] }));
    // p2's turn: the Bears attack, and the suspected Giant may not block them.
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: theirs, defender: at('p1') }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    expect(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: giant, attacker: theirs }] }).ok, 'a suspected creature cannot block').toBe(false);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [] }));
    settle(g);
    expect(g.state.cards[giant]?.suspected, 'it stays suspected - no duration but leaving').toBe(true);
    expect(zone(g, elves)).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Caught Red-Handed: the taken Bears untapped, hasty and suspected; control returns at end of turn, the mark stays', () => {
    const g = startedGame({ players: 2, decks: [['Caught Red-Handed', ...LANDS], ['Grizzly Bears', ...LANDS]] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Caught Red-Handed', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main(g, 3);
    mana(g, 'p1', 'R', 1);
    mana(g, 'p1', 'C', 4);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.controller).toBe('p1');
    expect(g.state.cards[bears]?.suspected).toBe(true);
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, bears);
    expect([d.keywords.has('menace'), d.keywords.has('haste')]).toEqual([true, true]);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(g.state.cards[bears]?.controller, 'the control ends with the turn').toBe('p2');
    expect(g.state.cards[bears]?.suspected, 'the mark does not').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a suspected creature that leaves and returns is a new object', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Hill Giant', ...LANDS], ['Reasonable Doubt', ...LANDS]] });
    holdEverywhere(g);
    const giant = put(g, 'p1', 'Hill Giant');
    main(g, 3);
    doubted(g, giant);
    expect(g.state.cards[giant]?.suspected).toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: giant, to: { kind: 'hand', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: giant, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.cards[giant]?.suspected, 'a new object').toBeUndefined();
    expect(menace(g, giant)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
