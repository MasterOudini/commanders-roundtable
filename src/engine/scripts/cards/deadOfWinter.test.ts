// `Dead of Winter` — X counts MY snow permanents (two Swamps + the Viper);
// nonsnow creatures anywhere take -X/-X and snow creatures are exempt. The
// surviving 6/6 reads derived power 3, which pins X at exactly three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEAD_OF_WINTER_SCRIPT } from './deadOfWinter';
import { DEAD_OF_WINTER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function frozen(): { g: Game; bears: InstanceId; maw: InstanceId; viper: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Dead of Winter', 'Snow-Covered Swamp', 'Snow-Covered Swamp', 'Ohran Viper'],
      ['Grizzly Bears', 'Colossal Dreadmaw'],
    ],
    scripts: createRegistry([DEAD_OF_WINTER_SCRIPT]),
  });
  put(g, 'p1', 'Snow-Covered Swamp');
  put(g, 'p1', 'Snow-Covered Swamp');
  const viper = put(g, 'p1', 'Ohran Viper');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Dead of Winter', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw, viper };
}

describe('Dead of Winter', () => {
  test('X = 3 (two Swamps + the Viper): the 2/2 dies, the 6/6 reads 3, the snow Viper is exempt', () => {
    const { g, bears, maw, viper } = frozen();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(3);
    expect(g.state.cards[viper]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, viper).power).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEAD_OF_WINTER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEAD_OF_WINTER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEAD_OF_WINTER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = frozen();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
