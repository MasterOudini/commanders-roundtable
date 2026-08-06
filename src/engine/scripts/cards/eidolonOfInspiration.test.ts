// `Eidolon of Inspiration` — its controller's beginning of combat asks for
// the aim, and the +2/+0 lands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EIDOLON_OF_INSPIRATION_SCRIPT } from './eidolonOfInspiration';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const EIDOLON = 'Eidolon of Inspiration';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function prompted(): { g: Game; eidolon: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[EIDOLON], []],
    scripts: createRegistry([EIDOLON_OF_INSPIRATION_SCRIPT]),
  });
  const eidolon = put(g, 'p1', EIDOLON);
  settle(g);
  // p1's own beginning of combat raises the aim — the Eidolon itself is
  // always a legal "creature you control", so the trigger survives CR 603.3d.
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, eidolon };
}

describe('Eidolon of Inspiration', () => {
  test('its controller\'s combat asks, and the +2/+0 lands on the aim', () => {
    const { g, eidolon } = prompted();
    expect(g.state.turn.step).toBe('beginCombat');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: eidolon }] }));
    settle(g);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' &&
          e.body.card === eidolon &&
          e.body.power === 2 &&
          e.body.toughness === 0,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, eidolon } = prompted();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: eidolon }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
