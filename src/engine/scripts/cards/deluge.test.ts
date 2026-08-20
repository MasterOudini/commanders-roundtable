// `Deluge` — the grounded creatures turn, the flyer stands upright.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DELUGE_SCRIPT } from './deluge';
import { DELUGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drowned(): { g: Game; bears: InstanceId; mine: InstanceId; strix: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Deluge', 'Grizzly Bears'], ['Grizzly Bears', 'Baleful Strix']],
    scripts: createRegistry([DELUGE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const strix = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Deluge', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, mine, strix };
}

describe('Deluge', () => {
  test('grounded creatures on BOTH sides tap; the flyer does not', () => {
    const { g, bears, mine, strix } = drowned();
    expect(g.state.cards[mine]?.tapped).toBe(true);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[strix]?.tapped).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DELUGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DELUGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DELUGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = drowned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
