// `Merfolk Skyscout` — attacking untaps a targeted permanent, and BLOCKING
// does too: the first attacks-or-blocks pair that carries a prompt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MERFOLK_SKYSCOUT_SCRIPT } from './merfolkSkyscout';
import { advanceUntil, fullControl, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SKYSCOUT = 'Merfolk Skyscout';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Merfolk Skyscout', () => {
  test('attacking untaps the targeted permanent', () => {
    const g = startedGame({
      players: 2,
      decks: [[SKYSCOUT, 'Mountain'], []],
      scripts: createRegistry([MERFOLK_SKYSCOUT_SCRIPT]),
    });
    const scout = put(g, 'p1', SKYSCOUT);
    const mountain = put(g, 'p1', 'Mountain');
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mountain], tapped: true }));
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    // Turn 3's untap step straightened the Mountain — turn it again so the
    // trigger has something to straighten.
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mountain], tapped: true }));
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: scout, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mountain }] }));
    settle(g);
    expect(g.state.cards[mountain]?.tapped).toBe(false);
  });

  test('BLOCKING untaps one too — the second arm', () => {
    const g = startedGame({
      players: 2,
      decks: [
        [SKYSCOUT, 'Mountain'],
        ['Grizzly Bears'],
      ],
      scripts: createRegistry([MERFOLK_SKYSCOUT_SCRIPT]),
    });
    const scout = put(g, 'p1', SKYSCOUT);
    const mountain = put(g, 'p1', 'Mountain');
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    fullControl(g, 'p2');
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mountain], tapped: true }));
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p2',
        attackers: [{ card: bears, defender: { kind: 'player', id: 'p1' } }],
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(
      g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: scout, attacker: bears }] }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mountain }] }));
    settle(g);
    expect(g.state.cards[mountain]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SKYSCOUT, 'Mountain'], []],
      scripts: createRegistry([MERFOLK_SKYSCOUT_SCRIPT]),
    });
    const scout = put(g, 'p1', SKYSCOUT);
    const mountain = put(g, 'p1', 'Mountain');
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mountain], tapped: true }));
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: scout, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mountain }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
