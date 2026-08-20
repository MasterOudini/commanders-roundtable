// `Guan Yu's 1,000-Li March` — tapped creatures die; upright ones and
// tapped INDESTRUCTIBLE ones stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GUAN_YUS_MARCH_SCRIPT } from './guanYusMarch';
import { GUAN_YU_S_1_000_LI_MARCH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function marched(): { g: Game; bears: InstanceId; herder: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Guan Yu's 1,000-Li March"], ['Grizzly Bears', 'Elvish Herder', 'Darksteel Myr']],
    scripts: createRegistry([GUAN_YUS_MARCH_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const herder = put(g, 'p2', 'Elvish Herder');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [bears, myr], tapped: true }));
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Guan Yu's 1,000-Li March", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, herder, myr };
}

describe("Guan Yu's 1,000-Li March", () => {
  test('the tapped 2/2 dies; the upright 1/1 and the tapped indestructible Myr stand', () => {
    const { g, bears, herder, myr } = marched();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[herder]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GUAN_YU_S_1_000_LI_MARCH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GUAN_YU_S_1_000_LI_MARCH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GUAN_YU_S_1_000_LI_MARCH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = marched();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
