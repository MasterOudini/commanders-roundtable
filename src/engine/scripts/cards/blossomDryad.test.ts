// `Blossom Dryad` — the untap, past summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLOSSOM_DRYAD_SCRIPT } from './blossomDryad';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DRYAD = 'Blossom Dryad';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; dryad: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DRYAD], ['Mountain']],
    scripts: createRegistry([BLOSSOM_DRYAD_SCRIPT]),
  });
  const mountain = put(g, 'p2', 'Mountain');
  const dryad = put(g, 'p1', DRYAD);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [mountain], tapped: true }));
  return { g, dryad, mountain };
}

describe('Blossom Dryad', () => {
  test('untaps the targeted land, asserted on the EVENT', () => {
    const { g, dryad, mountain } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: dryad,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: mountain }],
      }),
    );
    settle(g);
    expect(g.state.cards[mountain]?.tapped).toBe(false);
    expect(
      g.log.some((e) => e.body.t === 'PermanentsUntapped' && e.body.cards.includes(mountain)),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, dryad, mountain } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: dryad,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: mountain }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
