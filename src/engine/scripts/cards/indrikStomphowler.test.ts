// `Indrik Stomphowler` — entering destroys a chosen artifact; an
// indestructible one survives (CR 701.7b).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { INDRIK_STOMPHOWLER_SCRIPT } from './indrikStomphowler';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const INDRIK = 'Indrik Stomphowler';
const ARCHIVE = 'Hedron Archive';
const MYR = 'Darksteel Myr';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; archive: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[INDRIK, ARCHIVE, MYR], []],
    scripts: createRegistry([INDRIK_STOMPHOWLER_SCRIPT]),
  });
  const archive = put(g, 'p1', ARCHIVE);
  const myr = put(g, 'p1', MYR);
  settle(g);
  put(g, 'p1', INDRIK);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, archive, myr };
}

describe('Indrik Stomphowler', () => {
  test('entering destroys the chosen artifact', () => {
    const { g, archive } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: archive }] }));
    settle(g);
    expect(g.state.cards[archive]?.zone.kind).toBe('graveyard');
  });

  test('an indestructible artifact survives — the destroy stops, correctly', () => {
    const { g, myr } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: myr }] }));
    settle(g);
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, archive } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: archive }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
