// D431 - THE PLAYER QUEUE'S RETURN VERB: `Return a land you control to its owner's hand.` (the bounce lands)
// asks the caster to choose a permanent the noun admits, exactly as a queued sacrifice does (D390), and the
// pick goes to its owner's hand - no reason on the move, the batch's own narration. The caster's own
// sacrifice (`Sacrifice a creature.`) is the same queue over the `you` scope.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
/** An enters trigger whose payload is the printed sentence, read by the vocabulary bridge. */
function enterer(name: string, payload: string): CardScript {
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
const BOUNCER = enterer('Grizzly Bears', "Return a land you control to its owner's hand.");
const EATER = enterer('Coral Eel', 'Sacrifice a creature.');

function armed(script: CardScript, decks: readonly (readonly string[])[]): Game {
  const g = startedGame({ players: 2, decks, scripts: createRegistry([script]) });
  settle(g);
  holdEverywhere(g);
  return g;
}

describe('the return verb (D431)', () => {
  test('the caster chooses a land they control and it returns to their hand', () => {
    const g = armed(BOUNCER, [['Grizzly Bears', 'Forest', 'Forest', 'Coral Eel'], ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest']]);
    const forest = put(g, 'p1', 'Forest');
    const other = put(g, 'p1', 'Forest');
    const eel = put(g, 'p1', 'Coral Eel');
    settle(g);
    put(g, 'p1', 'Grizzly Bears');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    // Read with the prompt up: the harness put may have taken the Bears from the hand (D424).
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'chooseFromZone') throw new Error('no prompt');
    expect(a.zone).toBe('battlefield');
    expect(a.player).toBe('p1');
    expect(a.filter?.what).toBe('land');
    // A creature is not a land: refused.
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [eel] }).ok).toBe(false);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }));
    settle(g);
    expect(g.state.cards[forest]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(g.state.cards[eel]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[other]?.zone.kind).toBe('battlefield');
    const resolved = g.log.map((e) => e.body).filter((b) => b.t === 'AsksResolved');
    expect(resolved.length).toBe(1);
    expect(resolved[0]?.t === 'AsksResolved' ? resolved[0].verb : null).toBe('return');
    // The move carries no reason: a bounce is not a sacrifice.
    const move = g.log.map((e) => e.body).find((b) => b.t === 'CardsMoved' && b.moves.some((m) => m.card === forest && m.to.kind === 'hand'));
    expect(move && move.t === 'CardsMoved' ? move.moves.find((m) => m.card === forest)?.reason : 'missing').toBeUndefined();
  });

  test('with one land the return is forced without a prompt', () => {
    const g = armed(BOUNCER, [['Grizzly Bears', 'Forest'], ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest']]);
    const forest = put(g, 'p1', 'Forest');
    settle(g);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(g.state.cards[forest]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone')).toBe(false);
  });

  test("the caster's own sacrifice is the same queue over the you scope", () => {
    const g = armed(EATER, [['Coral Eel', 'Grizzly Bears', 'Grizzly Bears'], ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest']]);
    const bearsA = put(g, 'p1', 'Grizzly Bears');
    const bearsB = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const eel = put(g, 'p1', 'Coral Eel');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bearsA] }));
    settle(g);
    expect(g.state.cards[bearsA]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bearsB]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[eel]?.zone.kind).toBe('battlefield');
    const move = g.log.map((e) => e.body).find((b) => b.t === 'CardsMoved' && b.moves.some((m) => m.card === bearsA && m.to.kind === 'graveyard'));
    expect(move && move.t === 'CardsMoved' ? move.moves.find((m) => m.card === bearsA)?.reason : 'missing').toBe('sacrifice');
  });

  test('replays to the same hash', () => {
    const g = armed(BOUNCER, [['Grizzly Bears', 'Forest', 'Forest'], ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest']]);
    const forest = put(g, 'p1', 'Forest');
    put(g, 'p1', 'Forest');
    settle(g);
    put(g, 'p1', 'Grizzly Bears');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [forest] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
