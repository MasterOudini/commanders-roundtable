// `Thallid Soothsayer` — the creature chooser paying for a card, and it may
// eat ITSELF (CR 113.7a) with the ability still resolving.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THALLID_SOOTHSAYER_SCRIPT } from './thallidSoothsayer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SOOTH = 'Thallid Soothsayer';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hand(g: Game): number {
  return (g.state.zones.hand.p1 ?? []).length;
}

function game(): { g: Game; sooth: InstanceId; bears: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SOOTH, BEARS, RING], []],
    scripts: createRegistry([THALLID_SOOTHSAYER_SCRIPT]),
  });
  const sooth = put(g, 'p1', SOOTH);
  const bears = put(g, 'p1', BEARS);
  const ring = put(g, 'p1', RING);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, sooth, bears, ring };
}

describe('Thallid Soothsayer', () => {
  test('a creature pays and the card arrives', () => {
    const { g, sooth, bears } = game();
    const before = hand(g);
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: sooth, abilityIndex: 0, sacrifice: bears }),
    );
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(hand(g)).toBe(before + 1);
  });

  test('it may eat ITSELF, and the ability still resolves (CR 113.7a)', () => {
    const { g, sooth } = game();
    const before = hand(g);
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: sooth, abilityIndex: 0, sacrifice: sooth }),
    );
    settle(g);
    expect(g.state.cards[sooth]?.zone.kind).toBe('graveyard');
    expect(hand(g)).toBe(before + 1);
  });

  test('a NON-creature cannot pay the creature-only cost', () => {
    const { g, sooth, ring } = game();
    const r = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: sooth,
      abilityIndex: 0,
      sacrifice: ring,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, sooth, bears } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: sooth, abilityIndex: 0, sacrifice: bears }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
