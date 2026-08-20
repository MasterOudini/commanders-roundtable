// `Fight to the Death` — after a real block, the blocker and the blocked
// attacker both die; the unblocked attacker fights on.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FIGHT_TO_THE_DEATH_SCRIPT } from './fightToTheDeath';
import { FIGHT_TO_THE_DEATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fought(): { g: Game; blocked: InstanceId; free: InstanceId; blocker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Fight to the Death', 'Colossal Dreadmaw'],
      ['Grizzly Bears', 'Grizzly Bears'],
    ],
    scripts: createRegistry([FIGHT_TO_THE_DEATH_SCRIPT]),
  });
  const blocker = put(g, 'p1', 'Colossal Dreadmaw');
  const blocked = put(g, 'p2', 'Grizzly Bears');
  const free = put(g, 'p2', 'Grizzly Bears');
  expect(free).not.toBe(blocked);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 2 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [
        { card: blocked, defender: { kind: 'player', id: 'p1' } },
        { card: free, defender: { kind: 'player', id: 'p1' } },
      ],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(
    g.submit({
      t: 'DeclareBlockers',
      player: 'p1',
      blocks: [{ blocker, attacker: blocked }],
    }),
  );
  advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.blockers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', 'Fight to the Death', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, blocked, free, blocker };
}

describe('Fight to the Death', () => {
  test('the blocker and the blocked attacker die; the unblocked one lives', () => {
    const { g, blocked, free, blocker } = fought();
    expect(g.state.cards[blocker]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[blocked]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[free]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FIGHT_TO_THE_DEATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FIGHT_TO_THE_DEATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FIGHT_TO_THE_DEATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fought();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
