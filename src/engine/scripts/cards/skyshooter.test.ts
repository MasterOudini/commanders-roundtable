// `Skyshooter` — destroy on my ATTACKING creature: the right target is
// accepted, a creature that stayed home is refused (D291), and a
// ground attacker is refused (D289). Generated from one table row (D292).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKYSHOOTER_SCRIPT } from './skyshooter';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Skyshooter";
const BEARS = 'Grizzly Bears';
const HAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; wrong: InstanceId; ground: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, BEARS, BEARS, 'Vampire Nighthawk', 'Forest', 'Thraben Standard Bearer'], [BEARS, BEARS]],
    scripts: createRegistry([SKYSHOOTER_SCRIPT]),
  });
  const self = put(g, 'p1', CARD);
  const att = put(g, 'p1', HAWK);
  const home = put(g, 'p1', BEARS);
  const ground = put(g, 'p1', BEARS);
  settle(g);
  // Holds everywhere: without them the engine passes priority straight through
  // combat and the wait below never matches (D292).
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: att, defender: { kind: 'player', id: 'p2' } }, { card: ground, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  return { g, self, target: att, wrong: home, ground };
}

describe("Skyshooter", () => {
  test('the attacking creature is a legal target and the effect lands', () => {
    const { g, self, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('the wrong combat role is refused (D291); a ground attacker is refused (D289)', () => {
    const { g, wrong, ground } = armed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wrong }] }).ok).toBe(false);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ground }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
