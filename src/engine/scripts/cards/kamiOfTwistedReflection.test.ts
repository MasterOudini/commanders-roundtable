// `Kami of Twisted Reflection` — its body pays to bounce my own creature
// home.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KAMI_OF_TWISTED_REFLECTION_SCRIPT } from './kamiOfTwistedReflection';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KAMI = 'Kami of Twisted Reflection';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bounced(): { g: Game; kami: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KAMI, BEARS], []],
    scripts: createRegistry([KAMI_OF_TWISTED_REFLECTION_SCRIPT]),
  });
  const kami = put(g, 'p1', KAMI);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: kami, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, kami, bears };
}

describe('Kami of Twisted Reflection', () => {
  test('its body pays and my creature returns to my hand', () => {
    const { g, kami, bears } = bounced();
    expect(g.state.cards[kami]?.zone.kind).toBe('graveyard');
    const zone = g.state.cards[bears]?.zone;
    expect(zone?.kind).toBe('hand');
    expect(zone?.kind === 'hand' && zone.player).toBe('p1');
  });

  test('replays to the same hash', () => {
    const { g } = bounced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
