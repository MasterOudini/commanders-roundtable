// `Teferi's Care` — an enchantment of mine sold to destroy theirs; five mana
// to counter their enchantment spell on its way in.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEFERIS_CARE_SCRIPT } from './teferisCare';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARE = "Teferi's Care";
const SEASON = 'Season of Growth';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; care: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARE, SEASON], [SEASON]],
    scripts: createRegistry([TEFERIS_CARE_SCRIPT]),
  });
  holdEverywhere(g);
  const care = put(g, 'p1', CARE);
  const mine = put(g, 'p1', SEASON);
  const theirs = put(g, 'p2', SEASON);
  settle(g);
  return { g, care, mine, theirs };
}

/** p2 mid-cast of a Season of Growth, HELD on the stack, p1 holding priority. */
function heldSpell(): { g: Game; care: InstanceId; season: InstanceId; stackId: string } {
  const g = startedGame({
    players: 2,
    decks: [[CARE], [SEASON]],
    scripts: createRegistry([TEFERIS_CARE_SCRIPT]),
  });
  holdEverywhere(g);
  const care = put(g, 'p1', CARE);
  const season = put(g, 'p2', SEASON, 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 2 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: season }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const stackId = g.state.stack[0]?.id as string;
  return { g, care, season, stackId };
}

describe("Teferi's Care", () => {
  test('{W}, sacrifice my enchantment: theirs is destroyed, the Care stays', () => {
    const { g, care, mine, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: care, abilityIndex: 0, sacrifice: mine }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[mine]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[care]?.zone.kind).toBe('battlefield');
  });

  test('{3}{U}{U}: their enchantment spell is countered', () => {
    const { g, care, season, stackId } = heldSpell();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: care, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[season]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, care, season, stackId } = heldSpell();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: care, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    expect(g.state.cards[season]?.zone.kind).toBe('graveyard');
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
