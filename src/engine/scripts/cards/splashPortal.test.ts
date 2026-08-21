// `Splash Portal` — a flickered Bird pays a draw; a Bears pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPLASH_PORTAL_SCRIPT } from './splashPortal';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function splashed(name: string): { g: Game; flicked: InstanceId; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Splash Portal', name], []],
    scripts: createRegistry([SPLASH_PORTAL_SCRIPT]),
  });
  const flicked = put(g, 'p1', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Splash Portal', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: flicked }] }));
  settle(g);
  return { g, flicked, before };
}

describe('Splash Portal', () => {
  test('a flickered Bird pays a draw', () => {
    const { g, flicked, before } = splashed('Spire Owl');
    expect(g.state.cards[flicked]?.zone.kind).toBe('battlefield');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before);
  });

  test('a flickered Bears pays nothing', () => {
    const { g, flicked, before } = splashed('Grizzly Bears');
    expect(g.state.cards[flicked]?.zone.kind).toBe('battlefield');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before - 1);
  });

  test('replays to the same hash', () => {
    const { g } = splashed('Spire Owl');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
