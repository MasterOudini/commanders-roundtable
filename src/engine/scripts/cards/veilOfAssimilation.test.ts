// `Veil of Assimilation` — BOTH arms of the one printed line: an artifact
// CARD entering (CardsMoved) and an artifact TOKEN entering (TokenCreated),
// with the Veil's own entry paying because the clause says "this artifact OR
// another".

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { VEIL_OF_ASSIMILATION_SCRIPT } from './veilOfAssimilation';
import { URZAS_FACTORY_SCRIPT } from './urzasFactory';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VEIL = 'Veil of Assimilation';
const RING = 'Sol Ring';
const BEARS = 'Grizzly Bears';
const FACTORY = "Urza's Factory";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Veil of Assimilation', () => {
  test("its OWN entry pays — the clause says 'this artifact or another'", () => {
    const g = startedGame({
      players: 2,
      decks: [[VEIL, BEARS], []],
      scripts: createRegistry([VEIL_OF_ASSIMILATION_SCRIPT]),
    });
    const bears = put(g, 'p1', BEARS);
    settle(g);
    put(g, 'p1', VEIL);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.toughness).toBe(3);
    expect(d.keywords.has('vigilance')).toBe(true);
  });

  test('another artifact CARD entering pays too', () => {
    const g = startedGame({
      players: 2,
      decks: [[VEIL, RING, BEARS], []],
      scripts: createRegistry([VEIL_OF_ASSIMILATION_SCRIPT]),
    });
    const bears = put(g, 'p1', BEARS);
    put(g, 'p1', VEIL);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    // A second entry, a second pump.
    put(g, 'p1', RING);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(4);
  });

  test('an artifact TOKEN entering pays — the TokenCreated arm', () => {
    const g = startedGame({
      players: 2,
      decks: [[VEIL, FACTORY, BEARS], []],
      scripts: createRegistry([VEIL_OF_ASSIMILATION_SCRIPT, URZAS_FACTORY_SCRIPT]),
    });
    const bears = put(g, 'p1', BEARS);
    const factory = put(g, 'p1', FACTORY);
    put(g, 'p1', VEIL);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    holdEverywhere(g);
    advanceUntil(
      g,
      (s) =>
        s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
      120_000,
    );
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: factory, abilityIndex: 1 }));
    // The Assembly-Worker is an ARTIFACT creature token, so the Veil fires.
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const target: InstanceId = bears;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('vigilance')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[VEIL, BEARS], []],
      scripts: createRegistry([VEIL_OF_ASSIMILATION_SCRIPT]),
    });
    const bears = put(g, 'p1', BEARS);
    settle(g);
    put(g, 'p1', VEIL);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
