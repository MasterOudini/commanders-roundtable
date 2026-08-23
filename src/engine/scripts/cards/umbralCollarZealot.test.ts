// `Umbral Collar Zealot` — the sacrifice chooser paying a surveil, and the
// 'another' in the cost proved from the offer side: the Zealot cannot eat
// itself.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UMBRAL_COLLAR_ZEALOT_SCRIPT } from './umbralCollarZealot';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ZEALOT = 'Umbral Collar Zealot';
const FOOD = 'Sol Ring'; // an artifact — the OR arm
const BEARS = 'Grizzly Bears'; // a creature — the other arm

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; zealot: InstanceId; ring: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ZEALOT, FOOD, BEARS], []],
    scripts: createRegistry([UMBRAL_COLLAR_ZEALOT_SCRIPT]),
  });
  const zealot = put(g, 'p1', ZEALOT);
  const ring = put(g, 'p1', FOOD);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return { g, zealot, ring, bears };
}

describe('Umbral Collar Zealot', () => {
  test('sacrificing the ARTIFACT arm asks the surveil', () => {
    const { g, zealot, ring } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: zealot, abilityIndex: 0, sacrifice: ring }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.cards[revealed[0] as InstanceId]?.zone.kind).toBe('graveyard');
  });

  test('the CREATURE arm works too', () => {
    const { g, zealot, bears } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: zealot, abilityIndex: 0, sacrifice: bears }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test("'ANOTHER' means the Zealot cannot eat itself", () => {
    const { g, zealot } = armed();
    const res = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: zealot,
      abilityIndex: 0,
      sacrifice: zealot,
    });
    expect(res.ok).toBe(false);
    expect(g.state.cards[zealot]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, zealot, ring } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: zealot, abilityIndex: 0, sacrifice: ring }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
