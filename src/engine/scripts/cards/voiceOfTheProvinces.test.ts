// `Voice of the Provinces` — the untargeted ETB Human, and the flying line
// above it that never counts as an ability.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VOICE_OF_THE_PROVINCES_SCRIPT } from './voiceOfTheProvinces';
import { advanceUntil, battlefieldOf, deps, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VOICE = 'Voice of the Provinces';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; voice: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VOICE], []],
    scripts: createRegistry([VOICE_OF_THE_PROVINCES_SCRIPT]),
  });
  const voice = put(g, 'p1', VOICE);
  settle(g);
  return { g, voice };
}

describe('Voice of the Provinces', () => {
  test('the entry makes one 1/1 Human under MY control', () => {
    const { g } = entered();
    const humans = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Human');
    expect(humans).toHaveLength(1);
    const d = deps(createRegistry([VOICE_OF_THE_PROVINCES_SCRIPT]));
    const token = humans[0] as InstanceId;
    expect(derive(g.state, d.oracle, d.scripts, token).power).toBe(1);
    expect(derive(g.state, d.oracle, d.scripts, token).toughness).toBe(1);
  });

  test('the Voice itself still flies', () => {
    const { g, voice } = entered();
    const d = deps(createRegistry([VOICE_OF_THE_PROVINCES_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, voice).keywords.has('flying')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
