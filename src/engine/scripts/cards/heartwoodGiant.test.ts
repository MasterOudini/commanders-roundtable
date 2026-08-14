// `Heartwood Giant` — a Forest and the tap pay for 2 damage at a player,
// through the staged chain (D169): the pick rides the intent, the target
// prompt stages, the cost is charged on the answer. A non-Forest land is
// refused at the door.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HEARTWOOD_GIANT_SCRIPT } from './heartwoodGiant';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GIANT = 'Heartwood Giant';
const FOREST = 'Forest';
const FOUNTAIN = 'Radiant Fountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; giant: InstanceId; forest: InstanceId; fountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GIANT, FOREST, FOUNTAIN], []],
    scripts: createRegistry([HEARTWOOD_GIANT_SCRIPT]),
  });
  const giant = put(g, 'p1', GIANT);
  const forest = put(g, 'p1', FOREST);
  const fountain = put(g, 'p1', FOUNTAIN);
  settle(g);
  // {T} in the cost — a creature's tap ability waits out summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, giant, forest, fountain };
}

describe('Heartwood Giant', () => {
  test('a Forest and the tap deal 2 to the chosen player', () => {
    const { g, giant, forest } = board();
    const before = g.state.players['p2']?.life ?? 0;
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: giant, abilityIndex: 0, sacrifice: forest }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[forest]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[giant]?.tapped).toBe(true);
    expect(g.state.players['p2']?.life).toBe(before - 2);
  });

  test('a land that is not a Forest cannot pay', () => {
    const { g, giant, fountain } = board();
    const r = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: giant,
      abilityIndex: 0,
      sacrifice: fountain,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, giant, forest } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: giant, abilityIndex: 0, sacrifice: forest }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
