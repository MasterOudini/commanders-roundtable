// `Hold the Line` — the BLOCKER reads 8/8 mid-combat and eats the
// attacker; a creature not in the fight gets nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HOLD_THE_LINE_SCRIPT } from './holdTheLine';
import { HOLD_THE_LINE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function held(): { g: Game; attacker: InstanceId; blocker: InstanceId; spare: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hold the Line', 'Elvish Herder', 'Elvish Herder'], ['Grizzly Bears']],
    scripts: createRegistry([HOLD_THE_LINE_SCRIPT]),
  });
  const attacker = put(g, 'p2', 'Grizzly Bears');
  const blocker = put(g, 'p1', 'Elvish Herder');
  const spare = put(g, 'p1', 'Elvish Herder');
  expect(spare).not.toBe(blocker);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [{ card: attacker, defender: { kind: 'player', id: 'p1' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker, attacker }] }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.blockers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', 'Hold the Line', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, attacker, blocker, spare };
}

describe('Hold the Line', () => {
  test('the blocker reads 8/8; the non-blocker stays 1/1; the attacker dies to it', () => {
    const { g, attacker, blocker, spare } = held();
    expect(derive(g.state, ORACLE, g.deps.scripts, blocker).power).toBe(8);
    expect(derive(g.state, ORACLE, g.deps.scripts, spare).power).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(g.state.cards[attacker]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[blocker]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HOLD_THE_LINE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HOLD_THE_LINE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HOLD_THE_LINE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = held();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
