// `Death Begets Life` — creatures AND enchantments fall in one move, and
// the caster draws one per permanent destroyed this way.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEATH_BEGETS_LIFE_SCRIPT } from './deathBegetsLife';
import { DEATH_BEGETS_LIFE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function begotten(): { g: Game; bears: InstanceId; flame: InstanceId; mine: number } {
  const g = startedGame({
    players: 2,
    decks: [['Death Begets Life'], ['Grizzly Bears', 'Captive Flame']],
    scripts: createRegistry([DEATH_BEGETS_LIFE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const flame = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Death Begets Life', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, flame, mine };
}

describe('Death Begets Life', () => {
  test('the creature and the enchantment die; the caster draws two', () => {
    const { g, bears, flame, mine } = begotten();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEATH_BEGETS_LIFE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEATH_BEGETS_LIFE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEATH_BEGETS_LIFE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = begotten();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
