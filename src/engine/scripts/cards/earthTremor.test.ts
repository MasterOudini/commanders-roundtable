// `Earth Tremor` — three lands kill the 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EARTH_TREMOR_SCRIPT } from './earthTremor';
import { EARTH_TREMOR } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shaken(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Earth Tremor', 'Mountain', 'Mountain', 'Swamp'], ['Grizzly Bears']],
    scripts: createRegistry([EARTH_TREMOR_SCRIPT]),
  });
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Swamp');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Earth Tremor', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Earth Tremor', () => {
  test('three lands deal 3 — the 2/2 dies', () => {
    const { g, bears } = shaken();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EARTH_TREMOR.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EARTH_TREMOR.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EARTH_TREMOR.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = shaken();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
