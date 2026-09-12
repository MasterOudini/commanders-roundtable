// D407 - THE LINKED EXILE (CR 610.3): "exile target <X> until this permanent leaves the battlefield".
// The exile is LINKED to the resolving object's source by its ENTRY STAMP (CR 400.7: the reducer counts
// every entry); the state-based check returns the card to the battlefield under its owner's control
// the moment that permanent is gone or is a new object; a source already gone when the ability
// resolves exiles nothing (610.3b); a token in exile has ceased and never returns.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import type { Game } from './game';
import { SOLDIER_TOKEN } from '../data/fixtures/engineCards';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function armed(decks: readonly (readonly string[])[]): Game {
  const g = startedGame({ players: 2, decks, scripts: createRegistry([...SHIPPED_SCRIPTS]) });
  holdEverywhere(g);
  settle(g);
  const t0 = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}

describe('the linked exile (D407)', () => {
  test('Banishing Light exiles the Cyclops with the link and its entry stamp; the Cyclops returns under its owner the moment the Light leaves; the Light re-entering is a new object', () => {
    const g = armed([['Banishing Light', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']]);
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const light = put(g, 'p1', 'Banishing Light');
    // The enters trigger asks for its target: the Cyclops.
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[cyclops]?.zone.kind).toBe('exile');
    expect(g.state.cards[light]?.entries, 'the first entry').toBe(1);
    expect(g.state.cards[cyclops]?.exiledUntil, 'linked to the Light at its first entry').toEqual({ source: light, entry: 1 });
    // The Light leaves: the Cyclops is back under p2's control before anyone has priority.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: light, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[cyclops]?.zone.kind, 'CR 610.3c').toBe('battlefield');
    expect(g.state.cards[cyclops]?.controller).toBe('p2');
    expect(g.state.cards[cyclops]?.exiledUntil, 'the link is spent').toBeUndefined();
    expect(g.state.cards[cyclops]?.entries, 'the Cyclops entered twice').toBe(2);
    // The Light back on the battlefield is a NEW object: its stamp moves, nothing is re-exiled.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: light, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[light]?.entries).toBe(2);
    expect(g.state.cards[cyclops]?.exiledUntil, 'linked to the NEW object').toEqual({ source: light, entry: 2 });
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: light, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[cyclops]?.zone.kind, 'the second link ends the same way').toBe('battlefield');
    expect(g.state.cards[cyclops]?.entries).toBe(3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a source gone before its ability resolves exiles nothing (CR 610.3b); an exiled token never returns', () => {
    const g = armed([['Banishing Light', 'Fairgrounds Warden'], ['Cyclops of One-Eyed Pass']]);
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const light = put(g, 'p1', 'Banishing Light');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }));
    // The trigger is on the stack; the Light leaves first.
    expect(g.state.stack.length).toBe(1);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: light, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[cyclops]?.zone.kind, 'nothing is exiled').toBe('battlefield');
    expect(g.log.some((e) => e.body.t === 'Narrated' && /no longer on the battlefield: nothing is exiled/.test(e.body.text)), 'and the log says so').toBe(true);
    // A token: exiled by the Warden, it ceases; the Warden leaving returns nothing.
    must(g.submit({ t: 'ManualCreateToken', player: 'p2', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }));
    settle(g);
    const token = [...g.state.zones.battlefield].find((id) => g.state.cards[id]?.isToken && g.state.cards[id]?.controller === 'p2') as string;
    expect(token).toBeTruthy();
    const warden = put(g, 'p1', 'Fairgrounds Warden');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: token }] }));
    settle(g);
    expect(g.state.cards[token]?.zone.kind).not.toBe('battlefield');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: warden, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[token]?.zone.kind ?? 'gone', 'a token in exile has ceased').not.toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
