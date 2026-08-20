// `Gaze of Granite` — X = 2 destroys every nonland permanent at mana
// value 2 or less; the 6/6 and the lands stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GAZE_OF_GRANITE_SCRIPT } from './gazeOfGranite';
import { GAZE_OF_GRANITE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granited(): { g: Game; ring: InstanceId; strix: InstanceId; dreadmaw: InstanceId; swamp: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Gaze of Granite', 'Sol Ring', 'Swamp'], ['Baleful Strix', 'Colossal Dreadmaw']],
    scripts: createRegistry([GAZE_OF_GRANITE_SCRIPT]),
  });
  const ring = put(g, 'p1', 'Sol Ring');
  const swamp = put(g, 'p1', 'Swamp');
  const strix = put(g, 'p2', 'Baleful Strix');
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Gaze of Granite', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  settle(g);
  return { g, ring, strix, dreadmaw, swamp };
}

describe('Gaze of Granite', () => {
  test('mana value 2 or less dies on both sides; the 6/6 and the land stand', () => {
    const { g, ring, strix, dreadmaw, swamp } = granited();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[swamp]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GAZE_OF_GRANITE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GAZE_OF_GRANITE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GAZE_OF_GRANITE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = granited();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
