// `Thraxodemon` — the OR-predicate chooser with "another": it can never eat
// ITSELF, which is the one thing that separates it from Thallid Soothsayer.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THRAXODEMON_SCRIPT } from './thraxodemon';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DEMON = 'Thraxodemon';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring';
const FOREST = 'Forest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hand(g: Game): number {
  return (g.state.zones.hand.p1 ?? []).length;
}

function game(): { g: Game; demon: InstanceId; bears: InstanceId; ring: InstanceId; forest: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DEMON, BEARS, RING, FOREST], []],
    scripts: createRegistry([THRAXODEMON_SCRIPT]),
  });
  const demon = put(g, 'p1', DEMON);
  const bears = put(g, 'p1', BEARS);
  const ring = put(g, 'p1', RING);
  const forest = put(g, 'p1', FOREST);
  settle(g);
  // The {T} needs the Demon past summoning sickness (CR 302.6).
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, demon, bears, ring, forest };
}

describe('Thraxodemon', () => {
  test('another CREATURE pays and the card arrives', () => {
    const { g, demon, bears } = game();
    const before = hand(g);
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: demon, abilityIndex: 0, sacrifice: bears }),
    );
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(hand(g)).toBe(before + 1);
  });

  test('an ARTIFACT is the other arm', () => {
    const { g, demon, ring } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: demon, abilityIndex: 0, sacrifice: ring }),
    );
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
  });

  test('it can NEVER eat itself — the cost says "another"', () => {
    const { g, demon } = game();
    const r = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: demon,
      abilityIndex: 0,
      sacrifice: demon,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('a LAND is neither arm', () => {
    const { g, demon, forest } = game();
    const r = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: demon,
      abilityIndex: 0,
      sacrifice: forest,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, demon, bears } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: demon, abilityIndex: 0, sacrifice: bears }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
