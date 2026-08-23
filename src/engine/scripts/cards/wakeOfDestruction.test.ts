// `Wake of Destruction` — the NAME match takes every land sharing the
// target's name, whoever controls it, and leaves a differently-named land
// alone.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WAKE_OF_DESTRUCTION_SCRIPT } from './wakeOfDestruction';
import { WAKE_OF_DESTRUCTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Wake of Destruction';
const ISLAND = 'Island';
const FOREST = 'Forest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): {
  g: Game;
  target: InstanceId;
  theirIsland: InstanceId;
  myIsland: InstanceId;
  forest: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, ISLAND, FOREST],
      [ISLAND, ISLAND],
    ],
    scripts: createRegistry([WAKE_OF_DESTRUCTION_SCRIPT]),
  });
  const target = put(g, 'p2', ISLAND);
  const theirIsland = put(g, 'p2', ISLAND);
  const myIsland = put(g, 'p1', ISLAND);
  const forest = put(g, 'p1', FOREST);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 10 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target, theirIsland, myIsland, forest };
}

describe('Wake of Destruction', () => {
  test('every Island dies — theirs AND mine', () => {
    const { g, target, theirIsland, myIsland } = cast();
    for (const id of [target, theirIsland, myIsland]) {
      expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
    }
  });

  test('a Forest is a different name and survives', () => {
    const { g, forest } = cast();
    expect(g.state.cards[forest]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WAKE_OF_DESTRUCTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WAKE_OF_DESTRUCTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WAKE_OF_DESTRUCTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
