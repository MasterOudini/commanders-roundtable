// `Mosstodon` — the floored trample grant: a 6/6 takes it and loses it at
// cleanup, a 2/2 is REFUSED at activation.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOSSTODON_SCRIPT } from './mosstodon';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function grazed(): { g: Game; todon: InstanceId; titan: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mosstodon', 'Grave Titan', 'Grizzly Bears'], []],
    scripts: createRegistry([MOSSTODON_SCRIPT]),
  });
  const todon = put(g, 'p1', 'Mosstodon');
  const titan = put(g, 'p1', 'Grave Titan');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, todon, titan, bears };
}

describe('Mosstodon', () => {
  test('a 6/6 gains trample until cleanup; a 2/2 is refused', () => {
    const { g, todon, titan, bears } = grazed();
    const refused = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: todon,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    });
    expect(refused.ok).toBe(false);
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: todon,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: titan }],
      }),
    );
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, titan).keywords.has('trample')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, titan).keywords.has('trample')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, todon, titan } = grazed();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: todon,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: titan }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
