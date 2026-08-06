// `Barrage Ogre` — {T} plus the artifact predicate in one cost: past
// summoning sickness, the artifact pays and the Ogre stays turned.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BARRAGE_OGRE_SCRIPT } from './barrageOgre';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OGRE = 'Barrage Ogre';
const ARCHIVE = 'Hedron Archive';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; ogre: InstanceId; archive: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[OGRE, ARCHIVE], []],
    scripts: createRegistry([BARRAGE_OGRE_SCRIPT]),
  });
  const ogre = put(g, 'p1', OGRE);
  const archive = put(g, 'p1', ARCHIVE);
  settle(g);
  // The {T} in the cost gates on summoning sickness (CR 302.6).
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 20_000);
  return { g, ogre, archive };
}

describe('Barrage Ogre', () => {
  test('the artifact pays, the Ogre turns, and the target takes 2', () => {
    const { g, ogre, archive } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ogre, abilityIndex: 0, sacrifice: archive }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[archive]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[ogre]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, ogre, archive } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ogre, abilityIndex: 0, sacrifice: archive }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
