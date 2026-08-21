// `Tar Pitcher` — the Goblin-predicate chooser with an any-target ping and
// NO mana at all: the tap and the Goblin are the whole price.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TAR_PITCHER_SCRIPT } from './tarPitcher';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PITCHER = 'Tar Pitcher';
const GOBLIN = 'Krenko, Mob Boss';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; pitcher: InstanceId; goblin: InstanceId; myBears: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PITCHER, GOBLIN, BEARS], [BEARS]],
    scripts: createRegistry([TAR_PITCHER_SCRIPT]),
  });
  const pitcher = put(g, 'p1', PITCHER);
  const goblin = put(g, 'p1', GOBLIN);
  const myBears = put(g, 'p1', BEARS);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  // The {T} needs the Pitcher past summoning sickness (CR 302.6).
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    40_000,
  );
  return { g, pitcher, goblin, myBears, bears };
}

describe('Tar Pitcher', () => {
  test('a Goblin pays and the 2 damage kills the 2/2 through the SBA', () => {
    const { g, pitcher, goblin, bears } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: pitcher, abilityIndex: 0, sacrifice: goblin }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.cards[goblin]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[pitcher]?.tapped).toBe(true);
  });

  test('a PLAYER is the other arm of "any target"', () => {
    const { g, pitcher, goblin } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: pitcher, abilityIndex: 0, sacrifice: goblin }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(38);
  });

  test('a NON-Goblin creature cannot pay the Goblin-only cost', () => {
    const { g, pitcher, myBears } = game();
    const r = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: pitcher,
      abilityIndex: 0,
      sacrifice: myBears,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, pitcher, goblin, bears } = game();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: pitcher, abilityIndex: 0, sacrifice: goblin }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
