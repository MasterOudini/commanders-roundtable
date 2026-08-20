// `Nightmarish End` — the hand count kills the 2/2 through the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NIGHTMARISH_END_SCRIPT } from './nightmarishEnd';
import { NIGHTMARISH_END } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ended(): { g: Game; bears: InstanceId; hand: number } {
  const g = startedGame({
    players: 2,
    decks: [['Nightmarish End'], ['Grizzly Bears']],
    scripts: createRegistry([NIGHTMARISH_END_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Nightmarish End', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  const hand = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, bears, hand };
}

describe('Nightmarish End', () => {
  test('a two-plus hand kills the 2/2', () => {
    const { g, bears, hand } = ended();
    expect(hand).toBeGreaterThanOrEqual(2);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NIGHTMARISH_END.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NIGHTMARISH_END.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NIGHTMARISH_END.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ended();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
