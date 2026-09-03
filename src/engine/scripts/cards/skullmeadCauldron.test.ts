// `Skullmead Cauldron` — the tap alone is 1 life; the tap and a discarded
// card of my choice are 3, the card in my graveyard in the cost batch.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKULLMEAD_CAULDRON_SCRIPT } from './skullmeadCauldron';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CAULDRON = 'Skullmead Cauldron';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; cauldron: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CAULDRON], []],
    scripts: createRegistry([SKULLMEAD_CAULDRON_SCRIPT]),
  });
  const cauldron = put(g, 'p1', CAULDRON);
  settle(g);
  return { g, cauldron };
}

describe('Skullmead Cauldron', () => {
  test('{T}: 1 life', () => {
    const { g, cauldron } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cauldron, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[cauldron]?.tapped).toBe(true);
  });

  test('{T}, discard a card: 3 life, the card in my graveyard', () => {
    const { g, cauldron } = placed();
    const hand = idsIn(g, 'p1', 'hand');
    const chosen = hand[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cauldron, abilityIndex: 1, discard: [chosen], targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(idsIn(g, 'p1', 'hand').length).toBe(hand.length - 1);
  });

  test('the second ability refuses an activation that names no card', () => {
    const { g, cauldron } = placed();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: cauldron, abilityIndex: 1, targets: [] }).ok).toBe(false);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g, cauldron } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cauldron, abilityIndex: 1, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
