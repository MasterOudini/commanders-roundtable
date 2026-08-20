// `Dramatic Reversal` — my tapped creature and artifact straighten; my
// tapped LAND stays turned.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DRAMATIC_REVERSAL_SCRIPT } from './dramaticReversal';
import { DRAMATIC_REVERSAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reversed(): { g: Game; bears: InstanceId; ring: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dramatic Reversal', 'Grizzly Bears', 'Sol Ring', 'Mountain'], ['Grizzly Bears']],
    scripts: createRegistry([DRAMATIC_REVERSAL_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const ring = put(g, 'p1', 'Sol Ring');
  const land = put(g, 'p1', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears, ring, land], tapped: true }));
  const spell = put(g, 'p1', 'Dramatic Reversal', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, ring, land };
}

describe('Dramatic Reversal', () => {
  test('the creature and the artifact untap; the land stays tapped', () => {
    const { g, bears, ring, land } = reversed();
    expect(g.state.cards[bears]?.tapped).toBe(false);
    expect(g.state.cards[ring]?.tapped).toBe(false);
    expect(g.state.cards[land]?.tapped).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DRAMATIC_REVERSAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DRAMATIC_REVERSAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DRAMATIC_REVERSAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = reversed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
