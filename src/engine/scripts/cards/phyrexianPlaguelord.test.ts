// `Phyrexian Plaguelord` — the tap and itself take a 6/6 to 2/2; a creature
// alone, no mana, takes it to 5/5.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PHYREXIAN_PLAGUELORD_SCRIPT } from './phyrexianPlaguelord';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LORD = 'Phyrexian Plaguelord';
const TITAN = 'Grave Titan'; // 6/6
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; lord: InstanceId; titan: InstanceId; fodder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LORD, BEARS], [TITAN]],
    scripts: createRegistry([PHYREXIAN_PLAGUELORD_SCRIPT]),
  });
  const titan = put(g, 'p2', TITAN);
  const fodder = put(g, 'p1', BEARS);
  const lord = put(g, 'p1', LORD);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, lord, titan, fodder };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([PHYREXIAN_PLAGUELORD_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Phyrexian Plaguelord', () => {
  test('{T}, sacrifice itself: -4/-4', () => {
    const { g, lord, titan } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lord, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
    settle(g);
    expect(pt(g, titan)).toEqual({ power: 2, toughness: 2 });
    expect(g.state.cards[lord]?.zone.kind).toBe('graveyard');
  });

  test('sacrifice a creature, no mana: -1/-1', () => {
    const { g, lord, titan, fodder } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lord, abilityIndex: 1, sacrifice: fodder }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
    settle(g);
    expect(pt(g, titan)).toEqual({ power: 5, toughness: 5 });
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[lord]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, lord, titan, fodder } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lord, abilityIndex: 1, sacrifice: fodder }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
