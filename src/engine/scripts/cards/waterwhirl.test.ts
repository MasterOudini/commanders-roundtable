// `Waterwhirl` — the up-to-N class in the PLURAL. All three legal answers are
// proven: two, one, and none.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WATERWHIRL_SCRIPT } from './waterwhirl';
import { WATERWHIRL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { parseTargetClauses } from '../../../data/targetParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';
import type { TargetChoice } from '../../types/state';

const SPELL = 'Waterwhirl';
const BEARS = 'Grizzly Bears';
const ELVES = 'Llanowar Elves';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(pick: (ids: { a: InstanceId; b: InstanceId }) => TargetChoice[]): {
  g: Game;
  a: InstanceId;
  b: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS, ELVES]],
    scripts: createRegistry([WATERWHIRL_SCRIPT]),
  });
  const a = put(g, 'p2', BEARS);
  const b = put(g, 'p2', ELVES);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 10 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: pick({ a, b }) }));
  settle(g);
  return { g, a, b };
}

describe('Waterwhirl', () => {
  test('"up to two target creatures" parses min 0 / max 2', () => {
    const specs = parseTargetClauses(WATERWHIRL.faces[0]?.oracleText ?? '');
    expect(specs).toHaveLength(1);
    expect(specs[0]?.min).toBe(0);
    expect(specs[0]?.max).toBe(2);
  });

  test('BOTH creatures go home', () => {
    const { g, a, b } = cast(({ a: x, b: y }) => [
      { kind: 'card', id: x },
      { kind: 'card', id: y },
    ]);
    expect(g.state.cards[a]?.zone.kind).toBe('hand');
    expect(g.state.cards[b]?.zone.kind).toBe('hand');
  });

  test('ONE is a legal answer, and the other stays', () => {
    const { g, a, b } = cast(({ a: x }) => [{ kind: 'card', id: x }]);
    expect(g.state.cards[a]?.zone.kind).toBe('hand');
    expect(g.state.cards[b]?.zone.kind).toBe('battlefield');
  });

  test('NONE is a legal answer too — min is 0', () => {
    const { g, a, b } = cast(() => []);
    expect(g.state.cards[a]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[b]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WATERWHIRL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WATERWHIRL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WATERWHIRL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(({ a: x, b: y }) => [
      { kind: 'card', id: x },
      { kind: 'card', id: y },
    ]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
