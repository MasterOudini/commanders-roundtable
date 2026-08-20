// `Crimson Mage` — the mana-only grant repeats within a turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { CRIMSON_MAGE_SCRIPT } from './crimsonMage';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId; elf: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Crimson Mage', 'Grizzly Bears', 'Llanowar Elves'], ['Grizzly Bears']],
    scripts: createRegistry([CRIMSON_MAGE_SCRIPT]),
  });
  const mage = put(g, 'p1', 'Crimson Mage');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const elf = put(g, 'p1', 'Llanowar Elves');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mage, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: elf }] }));
  settle(g);
  return { g, bears, elf };
}

describe('Crimson Mage', () => {
  test('two activations in one turn grant BOTH creatures haste — no tap in the cost', () => {
    const { g, bears, elf } = granted();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, elf).keywords.has('haste')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
