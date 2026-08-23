// `Vessel of Ephemera` — two Spirits with DISTINCT ids (D164's allocator) and
// the Vessel eaten to pay for them.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { VESSEL_OF_EPHEMERA_SCRIPT } from './vesselOfEphemera';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VESSEL = 'Vessel of Ephemera';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function broken(): { g: Game; vessel: InstanceId; spirits: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[VESSEL], []],
    scripts: createRegistry([VESSEL_OF_EPHEMERA_SCRIPT]),
  });
  const vessel = put(g, 'p1', VESSEL);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: vessel, abilityIndex: 0 }));
  settle(g);
  const spirits = g.state.zones.battlefield.filter((id) => g.state.cards[id]?.isToken);
  return { g, vessel, spirits };
}

describe('Vessel of Ephemera', () => {
  test('TWO Spirits arrive with DISTINCT ids, and the Vessel is spent', () => {
    const { g, vessel, spirits } = broken();
    expect(spirits).toHaveLength(2);
    expect(new Set(spirits).size).toBe(2);
    expect(g.state.cards[vessel]?.zone.kind).toBe('graveyard');
  });

  test('each is a 1/1 with flying', () => {
    const { g, spirits } = broken();
    for (const id of spirits) {
      const d = derive(g.state, ORACLE, g.deps.scripts, id);
      expect(d.power).toBe(1);
      expect(d.toughness).toBe(1);
      expect(d.keywords.has('flying')).toBe(true);
    }
  });

  test('replays to the same hash', () => {
    const { g } = broken();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
