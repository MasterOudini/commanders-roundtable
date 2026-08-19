// `Mavren Fein, Dusk Apostle` — a nontoken Vampire attacking pays a token;
// the token itself attacking pays NOTHING (the nontoken filter, proven with
// the script's own product).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MAVREN_FEIN_DUSK_APOSTLE_SCRIPT } from './mavrenFeinDuskApostle';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAVREN = 'Mavren Fein, Dusk Apostle';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): readonly InstanceId[] {
  return battlefieldOf(g, 'p1').filter(
    (id) => nameOf(g, id) === 'Vampire' && g.state.cards[id]?.isToken,
  );
}

describe('Mavren Fein, Dusk Apostle', () => {
  test('Mavren attacking pays a token; the TOKEN attacking pays nothing', () => {
    const g = startedGame({
      players: 2,
      decks: [[MAVREN], []],
      scripts: createRegistry([MAVREN_FEIN_DUSK_APOSTLE_SCRIPT]),
    });
    const mavren = put(g, 'p1', MAVREN);
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
        attackers: [{ card: mavren, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    expect(tokens(g)).toHaveLength(1);
    const token = tokens(g)[0] as InstanceId;
    // Two turn cycles later the token may attack alone — a Vampire, but a
    // TOKEN, so the trigger stays quiet.
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 5 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: token, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    expect(tokens(g)).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[MAVREN], []],
      scripts: createRegistry([MAVREN_FEIN_DUSK_APOSTLE_SCRIPT]),
    });
    const mavren = put(g, 'p1', MAVREN);
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
        attackers: [{ card: mavren, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
