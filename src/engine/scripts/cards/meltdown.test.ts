// `Meltdown` — X=1: the Sol Ring dies, the mv-4 Hedron Archive stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MELTDOWN_SCRIPT } from './meltdown';
import { MELTDOWN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function molten(): { g: Game; ring: InstanceId; archive: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Meltdown', 'Sol Ring'], ['Hedron Archive']],
    scripts: createRegistry([MELTDOWN_SCRIPT]),
  });
  const ring = put(g, 'p1', 'Sol Ring');
  const archive = put(g, 'p2', 'Hedron Archive');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Meltdown', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 1 }));
  settle(g);
  return { g, ring, archive };
}

describe('Meltdown', () => {
  test('X=1 takes the Sol Ring and spares the Archive', () => {
    const { g, ring, archive } = molten();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[archive]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MELTDOWN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MELTDOWN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MELTDOWN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = molten();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
