// D410 - TYPECYCLING (CR 702.29b): cycling whose effect is a SEARCH for a card of the type - Ash Barrens'
// basic landcycling, Pale Recluse's two on one line - the discard charged as the cost, the search prompt
// raised natively, the found card to the hand, the library shuffled; the grant lines stay unread.

import { describe, expect, test } from 'vitest';
import { engineCompleteness } from '../data/engineComplete';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { legalActions } from './legal';
import { project } from './project';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
const SCRIPTS = createRegistry([]);
function board(hand: string): { g: Game; card: InstanceId } {
  const g = startedGame({ players: 2, decks: [[hand, 'Grizzly Bears', 'Coral Eel', 'Forest', 'Plains', 'Island'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const card = put(g, 'p1', hand, 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, card };
}
const view = (g: Game) => project(g.state, ORACLE, SCRIPTS, 'p1');
const nameOfId = (g: Game, id: InstanceId) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name ?? '';

describe('typecycling (D410)', () => {
  test('the faces read: Ash Barrens searches for a basic land, Pale Recluse carries two cyclings, Homing Sliver reads its own line and not the grant', () => {
    const barrens = ORACLE.byName('Ash Barrens')?.faces[0];
    const cyc = barrens?.activated.find((a) => a.cycling !== undefined);
    expect(cyc?.cycling?.type).toBe('basic land');
    expect(cyc?.cycling?.effects?.[0]?.kind).toBe('search');
    expect(cyc?.effectText).toBe('Search your library for a basic land card, reveal it, put it into your hand, then shuffle.');
    const barrensCard = ORACLE.byName('Ash Barrens');
    expect(barrensCard ? engineCompleteness(barrensCard.data) : null).toEqual({ complete: true, leftover: [] });
    const recluse = ORACLE.byName('Pale Recluse')?.faces[0];
    expect(recluse?.activated.filter((a) => a.cycling !== undefined).map((a) => [a.cycling?.type, a.costText])).toEqual([['Forest', '{2}'], ['Plains', '{2}']]);
    const sliver = ORACLE.byName('Homing Sliver');
    expect(sliver?.faces[0]?.activated.find((a) => a.cycling !== undefined)?.cycling?.type).toBe('Sliver');
    expect(sliver ? engineCompleteness(sliver.data).complete : null, 'the grant line stays unread').toBe(false);
  });

  test('Ash Barrens: offered from the hand, the card discarded as the cost, the search raised, a Forest found and the library shuffled; the replay hash', () => {
    const { g, card } = board('Ash Barrens');
    const offer = legalActions(g.state, ORACLE, SCRIPTS, 'p1').find((a) => a.t === 'ActivateAbility' && a.card === card);
    expect(offer, 'offered from the hand').toBeDefined();
    const idx = offer?.t === 'ActivateAbility' ? offer.abilityIndex : -1;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card, abilityIndex: idx }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    expect(g.state.cards[card]?.zone.kind, 'discarded as the cost').toBe('graveyard');
    const mine = view(g);
    const forest = mine.searching.find((id) => nameOfId(g, id) === 'Forest');
    expect(forest, 'a basic land among the candidates').toBeDefined();
    expect(mine.searching.every((id) => ['Forest', 'Plains', 'Island', 'Mountain', 'Swamp'].includes(nameOfId(g, id))), 'only basic lands').toBe(true);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [forest as InstanceId], declined: false }));
    settle(g);
    expect(g.state.cards[forest as InstanceId]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Pale Recluse: two abilities from one line, each offered; the plainscycling finds a Plains', () => {
    const { g, card } = board('Pale Recluse');
    const offers = legalActions(g.state, ORACLE, SCRIPTS, 'p1').filter((a) => a.t === 'ActivateAbility' && a.card === card);
    expect(offers.length).toBe(2);
    const plains = offers.find((a) => a.t === 'ActivateAbility' && a.label === 'Pale Recluse - Plainscycling');
    expect(plains).toBeDefined();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card, abilityIndex: plains?.t === 'ActivateAbility' ? plains.abilityIndex : -1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    const mine = view(g);
    // The prompt lists the whole library (the SET, sorted - D61); the answer is checked against the type.
    const forest = mine.searching.find((id) => nameOfId(g, id) === 'Forest') as InstanceId;
    const plainsCard = mine.searching.find((id) => nameOfId(g, id) === 'Plains') as InstanceId;
    expect(plainsCard).toBeDefined();
    expect(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [forest], declined: false }).ok, 'a Forest is not a Plains').toBe(false);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [plainsCard], declined: false }));
    settle(g);
    expect(g.state.cards[plainsCard]?.zone).toEqual({ kind: 'hand', player: 'p1' });
  });
});
