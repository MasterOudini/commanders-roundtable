// D516 - ACTING ON THE CARD THAT DIED. `Whenever a creature an opponent controls dies, exile it and put a +1/+1 counter
// on each Vampire you control.` (Patron of the Vein): the head looks back (CR 603.10a) and names the creature that died
// as its item (D515's unchecked referent); the executor's `exile` finds the card in its owner's graveyard - CR 400.7d,
// the trigger finds the card in the public zone it went to - and moves it from THERE (`moveTo` hardcodes the
// battlefield; the reducer would have left the graveyard array holding a card whose own zone said exile). A card that
// has left the graveyard before the trigger resolves is a new object (CR 400.7): nothing is exiled, and the line says
// so, while the clause after it still runs. What is proven here, on the landed row's own script: the Bears the enters
// trigger destroys is exiled out of the graveyard (the zone arrays agree with the card), both Vampires take a counter;
// the Bears taken back to hand while the trigger waits stays there, said, the counters still placed; the replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { PATRON_OF_THE_VEIN_SCRIPT } from './scripts/cards/patronOfTheVein';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
const narrations = (g: Game) => g.log.filter((e) => e.body.t === 'Narrated').map((e) => (e.body.t === 'Narrated' ? e.body.text : ''));

function armed() {
  const g = startedGame({ players: 2, decks: [['Patron of the Vein', 'Falkenrath Pit Fighter'], ['Grizzly Bears', 'Cyclops of One-Eyed Pass']], scripts: createRegistry([PATRON_OF_THE_VEIN_SCRIPT]) });
  holdEverywhere(g);
  const bears = put(g, 'p2', 'Grizzly Bears');
  const fighter = put(g, 'p1', 'Falkenrath Pit Fighter');
  settle(g);
  main(g, 3);
  // The Patron enters: its own enters trigger aims at the Bears, and the Bears' death fires the dies head.
  const patron = put(g, 'p1', 'Patron of the Vein');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  // The destroy resolves; the dies trigger waits on the stack under the holds.
  advanceUntil(g, (s) => s.stack.some((o) => (o.abilityRef ?? '').endsWith('#aCreatureDies-2')) && s.priority.awaiting === null, 20_000);
  return { g, bears, fighter, patron };
}

describe('D516 - acting on the card that died', () => {
  test('the def looks back and names the item; its payload exiles', () => {
    const def = PATRON_OF_THE_VEIN_SCRIPT.triggers?.find((t) => t.abilityId === 'aCreatureDies-2');
    expect(def?.looksBack).toBe(true);
    expect(typeof def?.perItem).toBe('function');
  });

  test('the Bears that died is exiled out of the graveyard: the zone arrays agree with the card; both Vampires take a counter; the replay hash', () => {
    const { g, bears, fighter, patron } = armed();
    expect(g.state.cards[bears]?.zone.kind, 'in the graveyard while the trigger waits').toBe('graveyard');
    settle(g);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'exile', player: 'p2' });
    expect(g.state.zones.graveyard.p2 ?? [], 'the graveyard no longer holds it').not.toContain(bears);
    expect(g.state.zones.exile.p2 ?? [], 'the exile zone does').toContain(bears);
    const moved = g.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === bears && m.to.kind === 'exile'));
    expect(moved).toHaveLength(1);
    expect(moved[0]?.body.t === 'CardsMoved' ? moved[0].body.moves[0]?.from : null, 'moved FROM the graveyard, not the battlefield').toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[fighter]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(g.state.cards[patron]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the Bears taken back to hand before the trigger resolves is a new object: nothing is exiled, said; the counters still go on; the replay hash', () => {
    const { g, bears, fighter, patron } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'hand', player: 'p2' } }));
    settle(g);
    expect(g.state.cards[bears]?.zone, 'still in hand').toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.zones.hand.p2 ?? []).toContain(bears);
    expect(g.state.zones.exile.p2 ?? []).not.toContain(bears);
    expect(narrations(g).some((t) => t.includes('finds a card that has moved on: nothing is exiled')), 'the clause says so').toBe(true);
    expect(g.state.cards[fighter]?.counters['+1/+1'] ?? 0, 'the clause after it still runs').toBe(1);
    expect(g.state.cards[patron]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
