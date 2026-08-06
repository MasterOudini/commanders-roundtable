// `Dispeller's Capsule` — destroys an artifact; an INDESTRUCTIBLE one
// survives and the Capsule stays spent (the no-refund rule).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DISPELLERS_CAPSULE_SCRIPT } from './dispellersCapsule';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CAPSULE = "Dispeller's Capsule";
const ARCHIVE = 'Hedron Archive';
const CITADEL = 'Darksteel Citadel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(theirArtifact: string): { g: Game; capsule: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CAPSULE], [theirArtifact]],
    scripts: createRegistry([DISPELLERS_CAPSULE_SCRIPT]),
  });
  const capsule = put(g, 'p1', CAPSULE);
  const theirs = put(g, 'p2', theirArtifact);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: capsule, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, capsule, theirs };
}

describe("Dispeller's Capsule", () => {
  test('destroys the target artifact with the Capsule spent as part of the cost', () => {
    const { g, capsule, theirs } = armed(ARCHIVE);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[capsule]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE artifact survives, and the Capsule stays spent', () => {
    const { g, capsule, theirs } = armed(CITADEL);
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[capsule]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(ARCHIVE);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
