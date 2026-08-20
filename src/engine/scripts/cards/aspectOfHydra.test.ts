// `Aspect of Hydra` — +X/+X where X is DEVOTION TO GREEN: one {G} pip from
// Llanowar Elves and one from the Bears themselves make the Bears a 4/4,
// with the pump gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ASPECT_OF_HYDRA_SCRIPT } from './aspectOfHydra';
import { ASPECT_OF_HYDRA } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumped(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Aspect of Hydra', 'Llanowar Elves', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ASPECT_OF_HYDRA_SCRIPT]),
  });
  put(g, 'p1', 'Llanowar Elves');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Aspect of Hydra', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Aspect of Hydra', () => {
  test('X is the {G} pips of MY permanents — the 2/2 becomes a 4/4', () => {
    const { g, bears } = pumped();
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, bears);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(4);
  });

  test('the pump ends at cleanup', () => {
    const { g, bears } = pumped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, bears);
    expect(d.power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ASPECT_OF_HYDRA.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ASPECT_OF_HYDRA.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ASPECT_OF_HYDRA.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = pumped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
