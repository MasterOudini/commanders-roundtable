// `Anarchy` — the first COLOR wipe: the White Knight dies, the colorless
// and off-color permanents stand. Membership is DERIVED color.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ANARCHY_SCRIPT } from './anarchy';
import { ANARCHY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; knight: InstanceId; bears: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Anarchy'], ['White Knight', 'Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([ANARCHY_SCRIPT]),
  });
  const knight = put(g, 'p2', 'White Knight');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  const spell = put(g, 'p1', 'Anarchy', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, knight, bears, myr };
}

describe('Anarchy', () => {
  test('the white creature dies; green and colorless stand', () => {
    const { g, knight, bears, myr } = board();
    expect(g.state.cards[knight]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ANARCHY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ANARCHY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ANARCHY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
