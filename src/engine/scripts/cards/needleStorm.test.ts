// `Needle Storm` — the flyer dies, the grounded creature is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NEEDLE_STORM_SCRIPT } from './needleStorm';
import { NEEDLE_STORM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stormed(): { g: Game; drake: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Needle Storm'], ['Muse Drake', 'Grizzly Bears']],
    scripts: createRegistry([NEEDLE_STORM_SCRIPT]),
  });
  const drake = put(g, 'p2', 'Muse Drake');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Needle Storm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, drake, bears };
}

describe('Needle Storm', () => {
  test('the flyer dies; the grounded Bears is untouched', () => {
    const { g, drake, bears } = stormed();
    expect(g.state.cards[drake]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.damage ?? 0).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NEEDLE_STORM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NEEDLE_STORM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NEEDLE_STORM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = stormed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
