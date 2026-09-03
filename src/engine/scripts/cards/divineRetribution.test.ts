// `Divine Retribution` — two attackers mean 2 damage to the targeted one; a
// creature at home is refused (D291).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DIVINE_RETRIBUTION_SCRIPT } from './divineRetribution';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Divine Retribution';
const BEARS = 'Grizzly Bears';
const HAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; hawk: InstanceId; home: InstanceId } {
  const g = startedGame({ players: 2, decks: [[SPELL, BEARS, BEARS, HAWK], []], scripts: createRegistry([DIVINE_RETRIBUTION_SCRIPT]) });
  const att = put(g, 'p1', BEARS);
  const hawk = put(g, 'p1', HAWK);
  const home = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        { card: att, defender: { kind: 'player', id: 'p2' } },
        { card: hawk, defender: { kind: 'player', id: 'p2' } },
      ],
    }),
  );
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, hawk, home };
}

describe('Divine Retribution', () => {
  test('deals damage equal to the number of attackers', () => {
    const { g, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    // Two attackers: 2 damage on the 2/3 Nighthawk, which lives.
    expect(g.state.cards[hawk]?.damage).toBe(2);
    expect(g.state.cards[hawk]?.zone.kind).toBe('battlefield');
  });

  test('a creature that stayed home is refused (D291)', () => {
    const { g, home } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: home }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
