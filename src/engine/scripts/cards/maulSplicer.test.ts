// `Maul Splicer` - entering makes two Golem tokens, and each has trample from the
// grant while the Splicer stays; a non-Golem does not; the grant ends when the
// Splicer leaves; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MAUL_SPLICER_SCRIPT } from './maulSplicer';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Maul Splicer';
const EEL = 'Coral Eel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([MAUL_SPLICER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function board(): { g: Game; self: InstanceId; eel: InstanceId; golems: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[CARD, EEL], [EEL]], scripts: createRegistry([MAUL_SPLICER_SCRIPT]) });
  holdEverywhere(g);
  const eel = put(g, 'p1', EEL);
  settle(g);
  const before = new Set(Object.keys(g.state.cards));
  const self = put(g, 'p1', CARD);
  settle(g);
  const golems = Object.values(g.state.cards)
    .filter((c) => !before.has(c.id) && c.id !== self && c.zone.kind === 'battlefield' && c.controller === 'p1')
    .map((c) => c.id);
  return { g, self, eel, golems };
}

describe('Maul Splicer', () => {
  test('entering makes two Golem tokens, each with trample; the Eel has none', () => {
    const { g, eel, golems } = board();
    expect(golems).toHaveLength(2);
    for (const id of golems) expect(kw(g, id).has('trample')).toBe(true);
    expect(kw(g, eel).has('trample')).toBe(false);
  });

  test('the grant ends when the Splicer leaves the battlefield', () => {
    const { g, self, golems } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    for (const id of golems) expect(kw(g, id).has('trample')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
