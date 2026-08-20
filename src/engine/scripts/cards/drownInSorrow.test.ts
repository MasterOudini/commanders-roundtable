// `Drown in Sorrow` — the -2/-2 lands FIRST (the 2/2 is dead before the
// ask is answered), then the scry sees one.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DROWN_IN_SORROW_SCRIPT } from './drownInSorrow';
import { DROWN_IN_SORROW } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drowned(): { g: Game; bears: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Drown in Sorrow'], ['Grizzly Bears']],
    scripts: createRegistry([DROWN_IN_SORROW_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Drown in Sorrow', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, bears, revealed };
}

describe('Drown in Sorrow', () => {
  test('the debuff lands before the ask; the scry sees ONE and the answer clears', () => {
    const { g, bears, revealed } = drowned();
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DROWN_IN_SORROW.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DROWN_IN_SORROW.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DROWN_IN_SORROW.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = drowned();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
