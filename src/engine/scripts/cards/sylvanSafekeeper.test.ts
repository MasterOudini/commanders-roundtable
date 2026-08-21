// `Sylvan Safekeeper` — the mana-free LAND chooser, and the grant it pays
// for is READ DERIVED: shroud arrives on the target through D194's carrier
// and is gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SYLVAN_SAFEKEEPER_SCRIPT } from './sylvanSafekeeper';
import { derive } from '../../derive';
import { advanceUntil, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KEEPER = 'Sylvan Safekeeper';
const FOREST = 'Forest';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; keeper: InstanceId; forest: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KEEPER, FOREST, BEARS], []],
    scripts: createRegistry([SYLVAN_SAFEKEEPER_SCRIPT]),
  });
  const keeper = put(g, 'p1', KEEPER);
  const forest = put(g, 'p1', FOREST);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, keeper, forest, bears };
}

describe('Sylvan Safekeeper', () => {
  test('a land pays and the target gains shroud — the cost waits for the answer', () => {
    const { g, keeper, forest, bears } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: keeper, abilityIndex: 0, sacrifice: forest }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    expect(g.state.cards[forest]?.zone.kind).toBe('battlefield');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.cards[forest]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('shroud')).toBe(true);
  });

  test('a NON-land cannot pay the land-only cost', () => {
    const { g, keeper, bears } = game();
    const r = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: keeper,
      abilityIndex: 0,
      sacrifice: bears,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('the shroud ENDS at cleanup, and it replays to the same hash', () => {
    const { g, keeper, forest, bears } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: keeper, abilityIndex: 0, sacrifice: forest }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('shroud')).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
