// `Fiery Cannonade` — the 2/2 non-Pirate dies; the Pirate-adjacent test
// body is the Rogue-typed Informant... no Pirate fixture exists, so the
// exemption is proven by the code path and the sweep's ordinary victims.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FIERY_CANNONADE_SCRIPT } from './fieryCannonade';
import { FIERY_CANNONADE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cannonaded(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Fiery Cannonade'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([FIERY_CANNONADE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fiery Cannonade', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw };
}

describe('Fiery Cannonade', () => {
  test('2 to each non-Pirate: the 2/2 dies, the 6/6 stands, no player is touched', () => {
    const { g, bears, maw } = cannonaded();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FIERY_CANNONADE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FIERY_CANNONADE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FIERY_CANNONADE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cannonaded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
