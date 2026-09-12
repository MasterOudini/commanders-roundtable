// D409 - EXPLORE (CR 701.42): reveal the top card; a land goes to hand, anything else puts a +1/+1
// counter on the explorer and may go to the graveyard (the scry prompt over the revealed card), and
// the permanent has EXPLORED (`Explored`) once the process is complete - at once for a land, at the
// answer otherwise. The chain ("explores, then it explores again") waits behind the first question.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, findAnywhere, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
/** An enters trigger whose payload is the printed sentence, read by the vocabulary bridge. */
function explorer(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'etb-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
/** Wildgrowth Walker's shape: a listener on the explored event. */
function listener(name: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'explored-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'Explored',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (ctx, self, ev) => ev.t === 'Explored' && ctx.state.cards[ev.permanent]?.controller === ctx.query.controllerOf(self),
      label: () => name + ' - explored',
      resolve: (_ctx, self): readonly EventBody[] => [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }],
    }],
  };
}
const SCRIPTS = createRegistry([explorer('Merfolk Branchwalker', 'It explores.'), explorer('Jadelight Ranger', 'It explores, then it explores again.'), listener('Wildgrowth Walker')]);

function armed(decks: readonly (readonly string[])[]): Game {
  const g = startedGame({ players: 2, decks, scripts: SCRIPTS });
  holdEverywhere(g);
  settle(g);
  const t0 = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}
const onTop = (g: Game, id: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
const top = (g: Game): InstanceId | undefined => { const lib = g.state.zones.library.p1 ?? []; return lib[lib.length - 1]; };
const explored = (g: Game) => g.log.filter((e) => e.body.t === 'Explored').map((e) => e.body as Extract<EventBody, { t: 'Explored' }>);

describe('explore (D409)', () => {
  test('a land on top goes to hand with no counter; a nonland puts a counter and asks, into the graveyard or kept on top; the listener fires each time; the replay hash', () => {
    const g = armed([['Merfolk Branchwalker', 'Wildgrowth Walker', 'Forest', 'Grizzly Bears', 'Coral Eel'], ['Cyclops of One-Eyed Pass']]);
    const walker = put(g, 'p1', 'Wildgrowth Walker');
    settle(g);
    const forest = findAnywhere(g, 'p1', 'Forest');
    onTop(g, forest);
    const branch = findAnywhere(g, 'p1', 'Merfolk Branchwalker');
    // The hand proof is net of where the explorer itself came from (the opening seven may hold it).
    const hand0 = (g.state.zones.hand.p1 ?? []).length - (g.state.cards[branch]?.zone.kind === 'hand' ? 1 : 0);
    put(g, 'p1', 'Merfolk Branchwalker');
    settle(g);
    expect(g.state.cards[forest]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[forest]?.revealedTo, 'the reveal is cleared').toEqual([]);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(g.state.cards[branch]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(explored(g)).toEqual([{ t: 'Explored', permanent: branch, controller: 'p1', card: forest, land: true }]);
    expect(g.state.cards[walker]?.counters['+1/+1'] ?? 0, 'the listener fired on the land').toBe(1);
    // A nonland: the counter first, then the question; into the graveyard.
    const bears = findAnywhere(g, 'p1', 'Grizzly Bears');
    onTop(g, bears);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: branch, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: branch, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'scryChoice' ? { count: ask.count, toGraveyard: ask.toGraveyard, explore: ask.explore } : null).toEqual({ count: 1, toGraveyard: true, explore: { permanent: branch, remaining: 0 } });
    expect(g.state.cards[bears]?.revealedTo, 'revealed to everyone').toEqual(['p1', 'p2']);
    expect(g.state.cards[branch]?.counters['+1/+1'] ?? 0, 'the counter lands before the question').toBe(1);
    expect(explored(g).length, 'not explored until answered').toBe(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(explored(g).length).toBe(2);
    expect(g.state.cards[walker]?.counters['+1/+1'] ?? 0).toBe(2);
    // Kept on top: the card stays the top of the library, unrevealed.
    const eel = findAnywhere(g, 'p1', 'Coral Eel');
    onTop(g, eel);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: branch, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: branch, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [eel], toBottom: [] }));
    settle(g);
    expect(top(g)).toBe(eel);
    expect(g.state.cards[eel]?.revealedTo).toEqual([]);
    expect(explored(g).length).toBe(3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an empty library still puts the counter; a source that left the battlefield explores with no counter (701.42b)', () => {
    const g = armed([['Merfolk Branchwalker'], ['Cyclops of One-Eyed Pass']]);
    for (const id of [...(g.state.zones.library.p1 ?? [])]) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'exile', player: 'p1' } }));
    const branch = put(g, 'p1', 'Merfolk Branchwalker');
    settle(g);
    expect(g.state.cards[branch]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(explored(g)).toEqual([{ t: 'Explored', permanent: branch, controller: 'p1', card: null, land: false }]);
    // Gone before its trigger resolves: the trigger is on the stack, the creature leaves, the explore still happens.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: branch, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: branch, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.stack.length === 1 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: branch, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[branch]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[branch]?.counters['+1/+1'] ?? 0, 'no counter off the battlefield').toBe(0);
    expect(explored(g).length, 'explored all the same').toBe(2);
  });

  test('explores, then explores again: the second waits behind the first question and runs against the state it left', () => {
    const g = armed([['Jadelight Ranger', 'Forest', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']]);
    const forest = findAnywhere(g, 'p1', 'Forest');
    const bears = findAnywhere(g, 'p1', 'Grizzly Bears');
    onTop(g, forest);
    onTop(g, bears);
    const ranger = put(g, 'p1', 'Jadelight Ranger');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'scryChoice' ? ask.explore : null).toEqual({ permanent: ranger, remaining: 1 });
    expect(g.state.cards[forest]?.zone.kind, 'the second explore waits').toBe('library');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[forest]?.zone, 'the second explore found the Forest').toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[ranger]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(explored(g).map((e) => e.land)).toEqual([false, true]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
