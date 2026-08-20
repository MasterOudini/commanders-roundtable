// `Beyond the Quiet` — exile all creatures AND Spacecraft: the non-creature
// Spacecraft goes, the plain artifact stays, and exile ignores
// indestructible.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BEYOND_THE_QUIET_SCRIPT } from './beyondTheQuiet';
import { BEYOND_THE_QUIET } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function quieted(): { g: Game; bears: InstanceId; craft: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Beyond the Quiet', 'Sol Ring'], ['Grizzly Bears', 'Uthros Research Craft']],
    scripts: createRegistry([BEYOND_THE_QUIET_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const craft = put(g, 'p2', 'Uthros Research Craft');
  const ring = put(g, 'p1', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Beyond the Quiet', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, craft, ring };
}

describe('Beyond the Quiet', () => {
  test('the creature AND the non-creature Spacecraft are exiled; the plain artifact stays', () => {
    const { g, bears, craft, ring } = quieted();
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect(g.state.cards[craft]?.zone.kind).toBe('exile');
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BEYOND_THE_QUIET.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BEYOND_THE_QUIET.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BEYOND_THE_QUIET.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = quieted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
