// `Tidy Conclusion` — two sentences, and the second reads the board the
// first one left behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TIDY_CONCLUSION_SCRIPT } from './tidyConclusion';
import { TIDY_CONCLUSION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Tidy Conclusion';
const BEARS = 'Grizzly Bears';
const MYR = 'Darksteel Myr'; // an INDESTRUCTIBLE artifact creature
const SOULEATER = 'Blinding Souleater'; // a DESTRUCTIBLE artifact creature
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Casts the Conclusion at `pick(board)` and reports the finished game. */
function concluded(
  mine: readonly string[],
  theirs: readonly string[],
  pick: (mineIds: InstanceId[], theirIds: InstanceId[]) => InstanceId,
): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...mine], [...theirs]],
    scripts: createRegistry([TIDY_CONCLUSION_SCRIPT]),
  });
  const mineIds = mine.map((n) => put(g, 'p1', n));
  const theirIds = theirs.map((n) => put(g, 'p2', n));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const victim = pick(mineIds, theirIds);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Tidy Conclusion', () => {
  test('the creature dies and TWO artifacts pay 2 life', () => {
    const { g, victim } = concluded([RING, RING], [BEARS], (_mine, theirs) => theirs[0] as InstanceId);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('an INDESTRUCTIBLE victim survives and the life is still paid', () => {
    const { g, victim } = concluded([RING], [MYR], (_mine, theirs) => theirs[0] as InstanceId);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('my own artifact creature destroyed by this spell does NOT count itself', () => {
    // ⚠️ The discriminating case: the Souleater is mine AND an artifact, but
    // the census is the SECOND sentence and by then the Souleater is in the
    // graveyard. Only the Sol Ring is left, so this is 41 and not 42.
    const { g, victim } = concluded([RING, SOULEATER], [], (mine) => mine[1] as InstanceId);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('no artifacts is a destroy and nothing else', () => {
    const { g } = concluded([], [BEARS], (_mine, theirs) => theirs[0] as InstanceId);
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TIDY_CONCLUSION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TIDY_CONCLUSION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TIDY_CONCLUSION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = concluded([RING], [BEARS], (_mine, theirs) => theirs[0] as InstanceId);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
