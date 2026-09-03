// `Narcissism` — the discard ability pumps and keeps the enchantment; the
// sacrifice ability pumps and takes it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NARCISSISM_SCRIPT } from './narcissism';
import { advanceUntil, deps, idsIn, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const NARCISSISM = 'Narcissism';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([NARCISSISM_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function placed(): { g: Game; narcissism: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[NARCISSISM, BEARS], []],
    scripts: createRegistry([NARCISSISM_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const narcissism = put(g, 'p1', NARCISSISM);
  settle(g);
  return { g, narcissism, bears };
}

describe('Narcissism', () => {
  test('{G}, discard a card: +2/+2, Narcissism stays', () => {
    const { g, narcissism, bears } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: narcissism, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
    expect(g.state.cards[narcissism]?.zone.kind).toBe('battlefield');
  });

  test('{G}, sacrifice: +2/+2, Narcissism gone', () => {
    const { g, narcissism, bears } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: narcissism, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
    expect(g.state.cards[narcissism]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, narcissism, bears } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: narcissism, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
