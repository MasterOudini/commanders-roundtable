// D412 - CONNIVE (CR 701.50): draw a card, then discard a card; a nonland card discarded this way puts a
// +1/+1 counter on the conniving permanent; the permanent has CONNIVED (`Connived`) once the process is
// complete - at the answer, or at once when there is nothing to discard.

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
function etb(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId, name,
    triggers: [{
      abilityId: 'etb-0', text: card.faces[0]?.oracleText ?? '', event: 'CardsMoved', activeZones: ['battlefield'], optional: false, targets,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
const SCRIPTS = createRegistry([etb("Raffine's Informant", 'It connives.'), etb('Mob Lookout', 'Target creature you control connives.')]);
function armed(decks: readonly (readonly string[])[]): Game {
  const g = startedGame({ players: 2, decks, scripts: SCRIPTS });
  holdEverywhere(g);
  settle(g);
  const t0 = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}
const connived = (g: Game) => g.log.filter((e) => e.body.t === 'Connived').map((e) => e.body as Extract<EventBody, { t: 'Connived' }>);
const onTop = (g: Game, id: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
const reenter = (g: Game, id: InstanceId) => {
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'hand', player: 'p1' } }));
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }));
};

describe('connive (D412)', () => {
  test('the Informant draws, asks for the discard, a nonland card puts the counter, a land does not; the marker comes with the answer; the replay hash', () => {
    const g = armed([["Raffine's Informant", 'Forest', 'Grizzly Bears', 'Coral Eel'], ['Cyclops of One-Eyed Pass']]);
    const bears = findAnywhere(g, 'p1', 'Grizzly Bears');
    onTop(g, bears);
    const informant = findAnywhere(g, 'p1', "Raffine's Informant");
    const fromHand = g.state.cards[informant]?.zone.kind === 'hand';
    const hand0 = (g.state.zones.hand.p1 ?? []).length - (fromHand ? 1 : 0);
    put(g, 'p1', "Raffine's Informant");
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'chooseFromZone' ? { zone: ask.zone, count: ask.count, connive: ask.connive } : null).toEqual({ zone: 'hand', count: 1, connive: { permanent: informant, remaining: 0 } });
    expect(g.state.cards[bears]?.zone, 'the draw came first').toEqual({ kind: 'hand', player: 'p1' });
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(connived(g).length, 'not connived until answered').toBe(0);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[informant]?.counters['+1/+1'] ?? 0, 'a nonland card: the counter').toBe(1);
    expect(connived(g)).toEqual([{ t: 'Connived', permanent: informant, controller: 'p1', card: bears, nonland: true }]);
    const forest = findAnywhere(g, 'p1', 'Forest');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: forest, to: { kind: 'hand', player: 'p1' } }));
    reenter(g, informant);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }));
    settle(g);
    expect(g.state.cards[forest]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[informant]?.counters['+1/+1'] ?? 0, 'a new object, and a land discarded').toBe(0);
    expect(connived(g).map((e) => e.nonland)).toEqual([true, false]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Mob Lookout: a target creature you control connives; with an empty library and hand it connives with nothing', () => {
    const g = armed([['Mob Lookout', 'Grizzly Bears', 'Coral Eel'], ['Cyclops of One-Eyed Pass']]);
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const eel = findAnywhere(g, 'p1', 'Coral Eel');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: eel, to: { kind: 'hand', player: 'p1' } }));
    const lookout = put(g, 'p1', 'Mob Lookout');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [eel] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(connived(g)[0]?.permanent).toBe(bears);
    for (const id of [...(g.state.zones.library.p1 ?? []), ...(g.state.zones.hand.p1 ?? [])]) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'exile', player: 'p1' } }));
    reenter(g, lookout);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(connived(g).length).toBe(2);
    expect(connived(g)[1]).toEqual({ t: 'Connived', permanent: bears, controller: 'p1', card: null, nonland: false });
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(1);
  });
});
