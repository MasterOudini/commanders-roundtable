// `Airborne Aid` — a card per DERIVED Bird, any controller.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AIRBORNE_AID_SCRIPT } from './airborneAid';
import { AIRBORNE_AID } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; libBefore: number } {
  const g = startedGame({
    players: 2,
    // Baleful Strix and Vampire Nighthawk fly; only the STRIX is a Bird.
    decks: [['Airborne Aid', 'Baleful Strix'], ['Baleful Strix', 'Grizzly Bears']],
    scripts: createRegistry([AIRBORNE_AID_SCRIPT]),
  });
  put(g, 'p1', 'Baleful Strix');
  put(g, 'p2', 'Baleful Strix');
  put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Airborne Aid', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  const libBefore = g.state.zones.library['p1']?.length ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, libBefore };
}

describe('Airborne Aid', () => {
  test('two Birds on the table — BOTH sides count — draw two', () => {
    const { g, libBefore } = cast();
    expect(g.state.zones.library['p1']?.length).toBe(libBefore - 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AIRBORNE_AID.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AIRBORNE_AID.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AIRBORNE_AID.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
