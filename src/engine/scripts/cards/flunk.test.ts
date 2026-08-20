// `Flunk` — the target's controller's EMPTY hand makes X = 7: the 6/6
// dies; a full seven-card hand blunts it to nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLUNK_SCRIPT } from './flunk';
import { FLUNK } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flunked(emptyHand: boolean): { g: Game; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Flunk'], ['Colossal Dreadmaw']],
    scripts: createRegistry([FLUNK_SCRIPT]),
  });
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  if (emptyHand) {
    for (const id of [...(g.state.zones.hand['p2'] ?? [])]) {
      must(
        g.submit({
          t: 'ManualMoveCard',
          player: 'p2',
          card: id,
          to: { kind: 'library', player: 'p2' },
        }),
      );
    }
  }
  const spell = put(g, 'p1', 'Flunk', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
  settle(g);
  return { g, maw };
}

describe('Flunk', () => {
  test('an empty hand makes X = 7 — the 6/6 dies', () => {
    const { g, maw } = flunked(true);
    expect(g.state.cards[maw]?.zone.kind).toBe('graveyard');
  });

  test('a full seven-card hand blunts it — the 6/6 stands', () => {
    const { g, maw } = flunked(false);
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLUNK.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLUNK.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLUNK.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flunked(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
