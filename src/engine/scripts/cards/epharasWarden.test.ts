// `Ephara's Warden` — power 3 or less taps; a 10/10 is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EPHARAS_WARDEN_SCRIPT } from './epharasWarden';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WARDEN = "Ephara's Warden";
const SMALL = 'Grizzly Bears';
const HUGE = 'Desolation Twin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; warden: InstanceId; small: InstanceId; huge: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WARDEN], [SMALL, HUGE]],
    scripts: createRegistry([EPHARAS_WARDEN_SCRIPT]),
  });
  const warden = put(g, 'p1', WARDEN);
  const small = put(g, 'p2', SMALL);
  const huge = put(g, 'p2', HUGE);
  settle(g);
  // {T} in the cost — the Warden must be past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, warden, small, huge };
}

describe("Ephara's Warden", () => {
  test('taps a power-2 creature; a power-10 one is refused at the aim', () => {
    const { g, warden, small, huge } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: warden, abilityIndex: 0 }));
    const wrong = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: huge }] });
    expect(wrong.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: small }] }));
    settle(g);
    expect(g.state.cards[small]?.tapped).toBe(true);
    expect(g.state.cards[huge]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, warden, small } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: warden, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: small }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
