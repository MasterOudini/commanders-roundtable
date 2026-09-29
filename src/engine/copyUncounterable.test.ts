// D587 (FIX-LIST 7, the review's WC-1) - A SPELL COPY OF AN UNCOUNTERABLE SPELL CAN'T BE COUNTERED. Copy into src/engine/.
// "This spell can't be countered." was read off the victim's CARD in both places a counter is decided - the funnel
// (`withoutCountersOfTheUncounterable`) and the executor's `counter` - and a spell copy has no card (card null, D487), though
// it has the copied text (CR 707.2) and the can't wins (CR 101.2). The merged ward-on-copies trigger (bf39140b) made it live:
// a Reverberate copy of Abrupt Decay retargeted at an opponent's Toadstool Admirer (Ward {2}) was COUNTERED by the ward, and a
// Counterspell aimed at a copy countered it too. Both places now ask one helper (`uncounterable`, triggers.ts) that reads a
// copy's copied printing. What is proven here: the ward still triggers against the copy (CR 702.21a), unpayable it counters
// nothing and says so, and the copy destroys the Admirer; with {2} to spare it asks, and declined the copy still resolves;
// Counterspell aimed at the copy counters nothing and says so, the copy resolving; the funnel drops a counter a script emits
// at the copy (a line in its place), while a Lightning Bolt copy's counter passes untouched; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { runReplacementFunnel } from './triggers';
import type { Game } from './game';
import type { InstanceId, PlayerId, StackId } from './types/ids';
import type { EventBody } from './types/events';
import type { StackObject } from './types/state';

const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: PlayerId, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const top = (g: Game) => g.state.stack[g.state.stack.length - 1]?.id as StackId;
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind ?? 'gone';
const pool = (g: Game, who: PlayerId) => Object.values(g.state.players[who]?.pool ?? {}).reduce((a, b) => a + b, 0);
const since = (g: Game, n0: number): EventBody[] => g.log.slice(n0).map((e) => e.body);
const wardTriggers = (g: Game, n0: number): StackObject[] => since(g, n0).flatMap((b) => (b.t === 'AbilityPutOnStack' && String(b.obj.abilityRef ?? '').endsWith('#ward') ? [b.obj] : []));
const countered = (g: Game, n0: number, id: StackId) => since(g, n0).some((b) => b.t === 'SpellCountered' && b.stackId === id);
const payAsks = (g: Game, n0: number) => since(g, n0).flatMap((b) => (b.t === 'AwaitingSet' && b.awaiting?.kind === 'payMana' ? [b.awaiting] : []));
const said = (g: Game, n0: number, text: string) => since(g, n0).some((b) => b.t === 'Narrated' && b.text.includes(text));
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const UNCOUNTERED = "Abrupt Decay (copy) can't be countered.";

/** Passes until the copy's new-targets question is up; its copy's stack id. */
function copyAsked(g: Game): StackId {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'copy', 20_000);
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'chooseTargets' || a.forKind !== 'copy') throw new Error('no copy-targets prompt');
  return a.stackId;
}

/** Passes until the ward's payment prompt is up (the trigger resolving). */
function wardAsked(g: Game) {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'payMana') throw new Error('no payment prompt');
  return a;
}

/**
 * p2 controls Grizzly Bears, a Sol Ring and a Toadstool Admirer (Ward {2}); p1, in their third main phase, casts `spell` at
 * the Bears and then Reverberate copying it, and the copy's new-targets question is up. p1 pays exactly the two costs, so
 * nothing is left for a ward unless `extra` floats beside them.
 */
function copyAtTheBears(spell: 'Abrupt Decay' | 'Lightning Bolt', extra = '') {
  const g = startedGame({ players: 2, decks: [[spell, 'Reverberate'], ['Grizzly Bears', 'Sol Ring', 'Toadstool Admirer', 'Counterspell']], options: { maxHandSize: null } });
  holdEverywhere(g);
  main3(g);
  const card = put(g, 'p1', spell, 'hand');
  const rev = put(g, 'p1', 'Reverberate', 'hand');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const ring = put(g, 'p2', 'Sol Ring');
  const admirer = put(g, 'p2', 'Toadstool Admirer');
  mana(g, 'p1', spell === 'Abrupt Decay' ? 'BG' : 'R');
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] }));
  const original = top(g);
  mana(g, 'p1', 'RR' + extra);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: rev, targets: [{ kind: 'stack', id: original }] }));
  const copy = copyAsked(g);
  return { g, bears, ring, admirer, original, copy };
}

describe("D587 - a copy of an uncounterable spell can't be countered (CR 707.2, 101.2)", () => {
  test('the ward meets a copy of Abrupt Decay retargeted at the Admirer: it triggers, unpayable it counters nothing, and the copy resolves', () => {
    const { g, bears, admirer, copy } = copyAtTheBears('Abrupt Decay');
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: admirer }] }));
    settle(g);
    const wards = wardTriggers(g, n0);
    expect(wards, 'the ward still triggers (CR 702.21a)').toHaveLength(1);
    expect(wards[0]?.controller, 'the warded creature controller controls it').toBe('p2');
    expect(wards[0]?.targets, 'the copy rides as its aim').toEqual([{ kind: 'stack', id: copy }]);
    expect(payAsks(g, n0), 'p1 cannot pay {2}: nothing is asked').toHaveLength(0);
    expect(countered(g, n0, copy), 'the copy is not countered').toBe(false);
    expect(said(g, n0, UNCOUNTERED), 'and the log says why').toBe(true);
    expect(zoneOf(g, admirer), 'the copy destroyed the Admirer').toBe('graveyard');
    expect(zoneOf(g, bears), 'the original destroyed the Bears').toBe('graveyard');
    hashHolds(g);
  });

  test('with {2} to spare the ward asks; declined, the copy still resolves and nothing is paid', () => {
    const { g, bears, admirer, copy } = copyAtTheBears('Abrupt Decay', 'CC');
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: admirer }] }));
    const ask = wardAsked(g);
    expect(ask.player, 'the copy controller is asked').toBe('p1');
    expect(ask.cost?.raw).toBe('{2}');
    expect(ask.targets).toEqual([{ kind: 'stack', id: copy }]);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    expect(pool(g, 'p1'), 'nothing was paid').toBe(2);
    settle(g);
    expect(countered(g, n0, copy), 'declining counters nothing').toBe(false);
    expect(said(g, n0, UNCOUNTERED)).toBe(true);
    expect(zoneOf(g, admirer), 'the copy destroyed the Admirer').toBe('graveyard');
    expect(zoneOf(g, bears)).toBe('graveyard');
    hashHolds(g);
  });

  test('Counterspell aimed at the copy counters nothing and says so; the copy resolves (the executor reads the copy)', () => {
    const { g, bears, ring, copy } = copyAtTheBears('Abrupt Decay');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    const counter = put(g, 'p2', 'Counterspell', 'hand');
    advanceUntil(g, (s) => s.priority.player === 'p2' && s.priority.awaiting === null, 20_000);
    expect(g.state.stack.map((o) => o.id), 'the copy waits on the stack').toContain(copy);
    mana(g, 'p2', 'UU');
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p2', card: counter, targets: [{ kind: 'stack', id: copy }] }));
    settle(g);
    expect(countered(g, n0, copy), 'no counter reaches the copy').toBe(false);
    expect(said(g, n0, UNCOUNTERED), 'the resolver says why').toBe(true);
    expect(said(g, n0, 'counters Abrupt Decay (copy)'), 'and never claims it').toBe(false);
    expect(zoneOf(g, ring), 'the copy destroyed the Sol Ring').toBe('graveyard');
    expect(zoneOf(g, bears), 'the original destroyed the Bears').toBe('graveyard');
    expect(zoneOf(g, counter)).toBe('graveyard');
    hashHolds(g);
  });

  test('the funnel drops a counter a script emits at the copy, a line in its place; a Lightning Bolt copy is still countered', () => {
    const decay = copyAtTheBears('Abrupt Decay');
    const bolt = copyAtTheBears('Lightning Bolt');
    const batch = (copy: StackId): EventBody[] => [{ t: 'SpellCountered', stackId: copy }];
    const d = runReplacementFunnel(decay.g.state, decay.g.deps.oracle, decay.g.deps.scripts, batch(decay.copy));
    expect(d.kind).toBe('done');
    if (d.kind !== 'done') return;
    expect(d.events.map((e) => e.t), 'the counter is dropped').toEqual(['Narrated']);
    const line = d.events[0];
    expect(line?.t === 'Narrated' ? line.text : '').toBe(UNCOUNTERED);
    const b = runReplacementFunnel(bolt.g.state, bolt.g.deps.oracle, bolt.g.deps.scripts, batch(bolt.copy));
    expect(b.kind === 'done' ? b.events.map((e) => e.t) : [], 'a copy of a counterable spell passes untouched').toEqual(['SpellCountered']);
    hashHolds(decay.g);
    hashHolds(bolt.g);
  });
});
