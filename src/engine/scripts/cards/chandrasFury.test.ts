// `Chandra's Fury` — 4 at the player and 1 to each of THEIR creatures; my
// creature untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CHANDRAS_FURY_SCRIPT } from './chandrasFury';
import { CHANDRA_S_FURY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function furied(): { g: Game; theirs: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Chandra's Fury", 'Grizzly Bears'], ['Colossal Dreadmaw']],
    scripts: createRegistry([CHANDRAS_FURY_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Chandra's Fury", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirs, mine };
}

describe("Chandra's Fury", () => {
  test('4 at the player, 1 to each of THEIR creatures, mine untouched', () => {
    const { g, theirs, mine } = furied();
    expect(g.state.players['p2']?.life).toBe(36);
    expect(g.state.cards[theirs]?.damage).toBe(1);
    expect(g.state.cards[mine]?.damage ?? 0).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CHANDRA_S_FURY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CHANDRA_S_FURY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CHANDRA_S_FURY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = furied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
