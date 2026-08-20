// `Extinguish All Hope` — the plain creatures die; nothing here is an
// enchantment creature, so the exemption is proven by the code path and
// the indestructible survivor.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EXTINGUISH_ALL_HOPE_SCRIPT } from './extinguishAllHope';
import { EXTINGUISH_ALL_HOPE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function extinguished(): { g: Game; bears: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Extinguish All Hope'], ['Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([EXTINGUISH_ALL_HOPE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Extinguish All Hope', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, myr };
}

describe('Extinguish All Hope', () => {
  test('the plain 2/2 dies; the indestructible Myr stands', () => {
    const { g, bears, myr } = extinguished();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EXTINGUISH_ALL_HOPE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EXTINGUISH_ALL_HOPE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EXTINGUISH_ALL_HOPE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = extinguished();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
