// `Melt Terrain` — the land dies and its controller pays 2; indestructible
// keeps the land and STILL pays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MELT_TERRAIN_SCRIPT } from './meltTerrain';
import { MELT_TERRAIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function melted(landName: string): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Melt Terrain'], [landName]],
    scripts: createRegistry([MELT_TERRAIN_SCRIPT]),
  });
  const land = put(g, 'p2', landName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Melt Terrain', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: land }] }),
  );
  settle(g);
  return { g, land };
}

describe('Melt Terrain', () => {
  test('the Mountain dies and its controller pays 2', () => {
    const { g, land } = melted('Mountain');
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('Darksteel Citadel survives and its controller STILL pays', () => {
    const { g, land } = melted('Darksteel Citadel');
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MELT_TERRAIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MELT_TERRAIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MELT_TERRAIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = melted('Mountain');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
