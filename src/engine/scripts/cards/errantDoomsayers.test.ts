// `Errant Doomsayers` — toughness 2 or less taps; a 3-toughness creature is
// refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ERRANT_DOOMSAYERS_SCRIPT } from './errantDoomsayers';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DOOMSAYERS = 'Errant Doomsayers';
const SMALL = 'Grizzly Bears';
const TOUGH = 'Krenko, Mob Boss';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; doomsayers: InstanceId; small: InstanceId; tough: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DOOMSAYERS], [SMALL, TOUGH]],
    scripts: createRegistry([ERRANT_DOOMSAYERS_SCRIPT]),
  });
  const doomsayers = put(g, 'p1', DOOMSAYERS);
  const small = put(g, 'p2', SMALL);
  const tough = put(g, 'p2', TOUGH);
  settle(g);
  // {T} in the cost — the Doomsayers must be past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, doomsayers, small, tough };
}

describe('Errant Doomsayers', () => {
  test('taps a toughness-2 creature; a toughness-3 one is refused at the aim', () => {
    const { g, doomsayers, small, tough } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: doomsayers, abilityIndex: 0 }));
    const wrong = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: tough }] });
    expect(wrong.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: small }] }));
    settle(g);
    expect(g.state.cards[small]?.tapped).toBe(true);
    expect(g.state.cards[tough]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, doomsayers, small } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: doomsayers, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: small }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
