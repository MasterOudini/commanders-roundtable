// `Displacement Wave` — X = 2 bounces the 2-drop and the 1-drop artifact
// on both sides; the 6-drop and the lands stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DISPLACEMENT_WAVE_SCRIPT } from './displacementWave';
import { DISPLACEMENT_WAVE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function waved(): { g: Game; bears: InstanceId; ring: InstanceId; maw: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Displacement Wave'], ['Grizzly Bears', 'Sol Ring', 'Colossal Dreadmaw', 'Mountain']],
    scripts: createRegistry([DISPLACEMENT_WAVE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const ring = put(g, 'p2', 'Sol Ring');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Displacement Wave', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  settle(g);
  return { g, bears, ring, maw, land };
}

describe('Displacement Wave', () => {
  test('X = 2: the 2-drop and the 1-drop bounce; the 6-drop and the land stand', () => {
    const { g, bears, ring, maw, land } = waved();
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(g.state.cards[ring]?.zone.kind).toBe('hand');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DISPLACEMENT_WAVE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DISPLACEMENT_WAVE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DISPLACEMENT_WAVE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = waved();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
