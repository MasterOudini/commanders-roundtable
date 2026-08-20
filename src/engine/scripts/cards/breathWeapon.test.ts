// `Breath Weapon` — 2 to each NON-Dragon creature: the Bears die, the
// Dragon is spared.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BREATH_WEAPON_SCRIPT } from './breathWeapon';
import { BREATH_WEAPON } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function breathed(): { g: Game; bears: InstanceId; dragon: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Breath Weapon', 'Boulderborn Dragon'], ['Grizzly Bears']],
    scripts: createRegistry([BREATH_WEAPON_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const dragon = put(g, 'p1', 'Boulderborn Dragon');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Breath Weapon', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, dragon };
}

describe('Breath Weapon', () => {
  test('the non-Dragon dies; the Dragon is untouched', () => {
    const { g, bears, dragon } = breathed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[dragon]?.damage ?? 0).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BREATH_WEAPON.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BREATH_WEAPON.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BREATH_WEAPON.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = breathed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
