// `Scorch the Fields` — the land dies and every Human takes 1 — MINE
// included.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCORCH_THE_FIELDS_SCRIPT } from './scorchTheFields';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scorched(): { g: Game; land: InstanceId; monk: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Scorch the Fields', 'Monk Realist'],
      ['Mountain', 'Grizzly Bears'],
    ],
    scripts: createRegistry([SCORCH_THE_FIELDS_SCRIPT]),
  });
  // Monk Realist is a 1/1 Human — it dies to its own controller's sweep.
  const monk = put(g, 'p1', 'Monk Realist');
  const land = put(g, 'p2', 'Mountain');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Scorch the Fields', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
  settle(g);
  return { g, land, monk, bears };
}

describe('Scorch the Fields', () => {
  test('the land dies; my own Human dies to the sweep; the Bears stand', () => {
    const { g, land, monk, bears } = scorched();
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[monk]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = scorched();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
