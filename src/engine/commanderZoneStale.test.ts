// A commander-zone choice answered AFTER the commander has moved on must
// be a no-op. Fuzz seed 69 found the corruption: Flicker of Fate exiles a
// commander (raising the choice) and returns it to the battlefield in the
// SAME resolve — answering "command zone" then moved it from the STALE
// recorded zone, leaving one card in two zone arrays at once.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { checkInvariants } from './invariants';
import { createRegistry } from './scripts/registry';
import { FLICKER_OF_FATE_SCRIPT } from './scripts/cards/flickerOfFate';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flickeredCommander(): { g: Game; krenko: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Flicker of Fate'], []],
    scripts: createRegistry([FLICKER_OF_FATE_SCRIPT]),
  });
  const krenko = (g.state.zones.command['p2'] ?? [])[0] as InstanceId;
  expect(krenko).toBeDefined();
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: krenko,
      to: { kind: 'battlefield', player: 'p2' },
    }),
  );
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flicker of Fate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: krenko }] }));
  // The settle auto-answers the commander-zone choice with toCommandZone: true
  // (the harness's simplestAnswer) — exactly the answer that corrupted seed 69.
  settle(g);
  return { g, krenko };
}

describe('a stale commander-zone choice (fuzz seed 69)', () => {
  test('the flickered commander stays on the battlefield; the yes is a no-op', () => {
    const { g, krenko } = flickeredCommander();
    expect(g.state.cards[krenko]?.zone.kind).toBe('battlefield');
    expect((g.state.zones.command['p2'] ?? []).includes(krenko)).toBe(false);
    expect(
      (g.state.zones.battlefield ?? []).filter((id) => id === krenko),
    ).toHaveLength(1);
    expect(checkInvariants(g.state)).toEqual([]);
  });

  test('replays to the same hash', () => {
    const { g } = flickeredCommander();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
