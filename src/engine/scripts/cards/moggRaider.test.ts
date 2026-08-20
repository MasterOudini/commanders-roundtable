// `Mogg Raider` — the Sledder text on a second id; it pays with ITSELF.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOGG_RAIDER_SCRIPT } from './moggRaider';
import { MOGG_RAIDER, GOBLIN_SLEDDER } from '../../../data/fixtures/engineCards';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function raided(): { g: Game; raider: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mogg Raider', 'Grizzly Bears'], []],
    scripts: createRegistry([MOGG_RAIDER_SCRIPT]),
  });
  const raider = put(g, 'p1', 'Mogg Raider');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, raider, bears };
}

describe('Mogg Raider', () => {
  test('carries the family text verbatim', () => {
    expect(MOGG_RAIDER.faces[0]?.oracleText).toBe(GOBLIN_SLEDDER.faces[0]?.oracleText);
  });

  test('pays with itself and pumps the Bears', () => {
    const { g, raider, bears } = raided();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: raider,
        abilityIndex: 0,
        sacrifice: raider,
      }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[raider]?.zone.kind).toBe('graveyard');
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.toughness).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g, raider, bears } = raided();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: raider,
        abilityIndex: 0,
        sacrifice: raider,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
