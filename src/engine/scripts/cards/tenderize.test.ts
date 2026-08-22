// `Tenderize` — the two-controller bite, third card in the class.
//
// ⚠️ The swapped case pins the SAME measured engine behaviour D255 found on
// Swift Kick and D256 reproduced on Tail Slash: the aim ACCEPTS a swapped
// answer (assignTargets is a one-for-one matching that does not reorder) and
// the spell then does NOTHING, because the resolution-time re-check reads the
// def's specs POSITIONALLY. This resolve never touches an index, so a third
// inert result is more evidence the fizzle is the engine's, not the script's.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TENDERIZE_SCRIPT } from './tenderize';
import { TENDERIZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TITAN = 'Grave Titan';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bitten(swap: boolean): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Tenderize', TITAN], [BEARS]],
    scripts: createRegistry([TENDERIZE_SCRIPT]),
  });
  const mine = put(g, 'p1', TITAN);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Tenderize', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const answer = swap
    ? [
        { kind: 'card' as const, id: theirs },
        { kind: 'card' as const, id: mine },
      ]
    : [
        { kind: 'card' as const, id: mine },
        { kind: 'card' as const, id: theirs },
      ];
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: answer }));
  settle(g);
  return { g, mine, theirs };
}

describe('Tenderize', () => {
  test('my creature bites theirs for its power, and mine is untouched', () => {
    const { g, mine, theirs } = bitten(false);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('a swapped answer is accepted at the aim and then does nothing', () => {
    const { g, mine, theirs } = bitten(true);
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TENDERIZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TENDERIZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TENDERIZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bitten(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
