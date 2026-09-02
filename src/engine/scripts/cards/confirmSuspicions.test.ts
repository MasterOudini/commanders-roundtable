// `Confirm Suspicions` — a held spell is countered and three Clues arrive
// with it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CONFIRM_SUSPICIONS_SCRIPT } from './confirmSuspicions';
import { CONFIRM_SUSPICIONS } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Confirm Suspicions';
const BEARS = 'Grizzly Bears';
const CLUE = TOKEN_TABLE['Clue|/||Artifact|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cluesOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === CLUE?.printingId;
  }).length;
}

/** p2 mid-cast of the Bears, HELD on the stack; p1 answers with the counter. */
function countered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS]],
    scripts: createRegistry([CONFIRM_SUSPICIONS_SCRIPT]),
  });
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS, 'hand');
  const spell = put(g, 'p1', SPELL, 'hand');
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
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const stackId = g.state.stack[0]?.id as string;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, bears };
}

describe('Confirm Suspicions', () => {
  test('the Bears never resolves and I hold three Clues', () => {
    const { g, bears } = countered();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
    expect(cluesOf(g, 'p1')).toBe(3);
    expect(cluesOf(g, 'p2')).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CONFIRM_SUSPICIONS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CONFIRM_SUSPICIONS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CONFIRM_SUSPICIONS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = countered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
