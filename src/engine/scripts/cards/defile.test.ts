// `Defile` — two Swamps make it -2/-2, which kills the 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEFILE_SCRIPT } from './defile';
import { DEFILE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function defiled(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Defile', 'Swamp', 'Swamp'], ['Grizzly Bears']],
    scripts: createRegistry([DEFILE_SCRIPT]),
  });
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Swamp');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Defile', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Defile', () => {
  test('two Swamps kill the 2/2', () => {
    const { g, bears } = defiled();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEFILE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEFILE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEFILE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = defiled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
