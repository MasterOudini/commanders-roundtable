// `Jedit Ojanen of Efrava` — BOTH arms of one line: attacking makes a Cat
// Warrior, and BLOCKING makes another (the first BlockersDeclared consumer).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JEDIT_OJANEN_OF_EFRAVA_SCRIPT } from './jeditOjanenOfEfrava';
import {
  advanceUntil,
  battlefieldOf,
  fullControl,
  must,
  nameOf,
  put,
  startedGame,
} from '../../testing/harness';
import type { Game } from '../../game';

const JEDIT = 'Jedit Ojanen of Efrava';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cats(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Cat Warrior').length;
}

describe('Jedit Ojanen of Efrava', () => {
  test('attacking makes a 2/2 Cat Warrior', () => {
    const g = startedGame({
      players: 2,
      decks: [[JEDIT], []],
      scripts: createRegistry([JEDIT_OJANEN_OF_EFRAVA_SCRIPT]),
    });
    const jedit = put(g, 'p1', JEDIT);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: jedit, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    expect(cats(g)).toBe(1);
  });

  test('BLOCKING makes one too — the second arm of the printed line', () => {
    const g = startedGame({
      players: 2,
      decks: [[JEDIT], [BEARS]],
      scripts: createRegistry([JEDIT_OJANEN_OF_EFRAVA_SCRIPT]),
    });
    const jedit = put(g, 'p1', JEDIT);
    const bears = put(g, 'p2', BEARS);
    settle(g);
    // p2's declaration is auto-answered (declare none) under default stops —
    // hold p2 so the prompt stays up for a scripted attack.
    fullControl(g, 'p2');
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p2',
        attackers: [{ card: bears, defender: { kind: 'player', id: 'p1' } }],
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(
      g.submit({
        t: 'DeclareBlockers',
        player: 'p1',
        blocks: [{ blocker: jedit, attacker: bears }],
      }),
    );
    settle(g);
    expect(cats(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[JEDIT], []],
      scripts: createRegistry([JEDIT_OJANEN_OF_EFRAVA_SCRIPT]),
    });
    const jedit = put(g, 'p1', JEDIT);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: jedit, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
