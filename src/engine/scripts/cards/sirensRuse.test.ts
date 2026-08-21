// `Siren's Ruse` — the flicker pays a draw only for a Pirate; the hand
// baseline is captured BEFORE the cast (the spell resolves inside its own
// submit).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SIRENS_RUSE_SCRIPT } from './sirensRuse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flickered(name: string): { g: Game; flicked: InstanceId; before: number } {
  const g = startedGame({
    players: 2,
    decks: [["Siren's Ruse", name], []],
    scripts: createRegistry([SIRENS_RUSE_SCRIPT]),
  });
  const flicked = put(g, 'p1', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Siren's Ruse", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: flicked }] }));
  settle(g);
  return { g, flicked, before };
}

describe("Siren's Ruse", () => {
  test('a flickered Pirate comes back and pays a draw', () => {
    const { g, flicked, before } = flickered('Daring Buccaneer');
    expect(g.state.cards[flicked]?.zone.kind).toBe('battlefield');
    // The Ruse left the hand and the draw refilled it.
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before);
  });

  test('a flickered Bears comes back and pays nothing', () => {
    const { g, flicked, before } = flickered('Grizzly Bears');
    expect(g.state.cards[flicked]?.zone.kind).toBe('battlefield');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before - 1);
  });

  test('replays to the same hash', () => {
    const { g } = flickered('Daring Buccaneer');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
