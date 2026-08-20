// `Molten Rain` — a basic dies free of the recoil; a nonbasic
// indestructible survives and its controller STILL pays 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MOLTEN_RAIN_SCRIPT } from './moltenRain';
import { MOLTEN_RAIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rained(landName: string): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Molten Rain'], [landName]],
    scripts: createRegistry([MOLTEN_RAIN_SCRIPT]),
  });
  const land = put(g, 'p2', landName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Molten Rain', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: land }] }),
  );
  settle(g);
  return { g, land };
}

describe('Molten Rain', () => {
  test('a basic Mountain dies with NO recoil', () => {
    const { g, land } = rained('Mountain');
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('nonbasic Darksteel Citadel survives and its controller STILL pays 2', () => {
    const { g, land } = rained('Darksteel Citadel');
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MOLTEN_RAIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MOLTEN_RAIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MOLTEN_RAIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = rained('Mountain');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
