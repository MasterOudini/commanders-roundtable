// `The Immortal Weapons` — the entry returns an instant from my graveyard to
// my hand; a noncreature spell of mine aims +2/+0 and menace at a creature
// until cleanup; a creature spell aims nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THE_IMMORTAL_WEAPONS_SCRIPT } from './theImmortalWeapons';
import { SORCEROUS_SIGHT_SCRIPT } from './sorcerousSight';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WEAPONS = 'The Immortal Weapons';
const BEARS = 'Grizzly Bears';
const SNUFF = 'Spell Snuff';
const SIGHT = 'Sorcerous Sight';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chars(g: Game, id: InstanceId): ReturnType<typeof derive> {
  const d = deps(createRegistry([THE_IMMORTAL_WEAPONS_SCRIPT, SORCEROUS_SIGHT_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id);
}

function armed(): { g: Game; weapons: InstanceId; bears: InstanceId; snuff: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WEAPONS, BEARS, SNUFF, SIGHT, BEARS], []],
    scripts: createRegistry([THE_IMMORTAL_WEAPONS_SCRIPT, SORCEROUS_SIGHT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p1', BEARS);
  const snuff = put(g, 'p1', SNUFF, 'graveyard');
  settle(g);
  const weapons = put(g, 'p1', WEAPONS);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: snuff }] }));
  settle(g);
  return { g, weapons, bears, snuff };
}

describe('The Immortal Weapons', () => {
  test('entering returns the instant from my graveyard to my hand', () => {
    const { g, snuff } = armed();
    expect(g.state.cards[snuff]?.zone).toEqual({ kind: 'hand', player: 'p1' });
  });

  test('a noncreature spell aims +2/+0 and menace at the bear until cleanup', () => {
    const { g, bears } = armed();
    const sight = put(g, 'p1', SIGHT, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: sight }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const got = chars(g, bears);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 4, toughness: 2 });
    expect(got.keywords.has('menace')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const later = chars(g, bears);
    expect({ power: later.power, toughness: later.toughness }).toEqual({ power: 2, toughness: 2 });
    expect(later.keywords.has('menace')).toBe(false);
  });

  test('a creature spell aims nothing', () => {
    const { g, bears } = armed();
    const second = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: second }));
    settle(g);
    expect(g.state.cards[second]?.zone.kind).toBe('battlefield');
    expect(g.log.slice(logAt).some((e) => e.body.t === 'PtModifiedUntilEndOfTurn')).toBe(false);
    const got = chars(g, bears);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 2, toughness: 2 });
  });

  test('replays to the same hash', () => {
    const { g, bears } = armed();
    const sight = put(g, 'p1', SIGHT, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: sight }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
