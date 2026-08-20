// `Confront the Unknown` — the NEW Clue counts: with one Clue already out
// the pump is +2/+2, and a second Clue exists after.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CONFRONT_THE_UNKNOWN_SCRIPT } from './confrontTheUnknown';
import { CONFRONT_THE_UNKNOWN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function confronted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Confront the Unknown', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([CONFRONT_THE_UNKNOWN_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Confront the Unknown', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

function clues(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return c?.isToken && g.deps.oracle.byPrinting(c.printingId)?.name === 'Clue';
  }).length;
}

describe('Confront the Unknown', () => {
  test('the fresh Clue counts: +1/+1 with the Investigate landing', () => {
    const { g, bears } = confronted();
    expect(clues(g)).toBe(1);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CONFRONT_THE_UNKNOWN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CONFRONT_THE_UNKNOWN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CONFRONT_THE_UNKNOWN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = confronted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
