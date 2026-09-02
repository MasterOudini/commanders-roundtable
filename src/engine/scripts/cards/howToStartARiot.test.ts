// `How to Start a Riot` — the creature gains menace, every creature the
// targeted player controls gets +2/+0, and mine (not the target player's)
// stays 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HOW_TO_START_ARIOT_SCRIPT } from './howToStartARiot';
import { HOW_TO_START_A_RIOT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'How to Start a Riot';
const BEARS = 'Grizzly Bears';
const TITAN = 'Grave Titan';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rioted(): { g: Game; mine: InstanceId; theirs: InstanceId; theirTitan: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [BEARS, TITAN]],
    scripts: createRegistry([HOW_TO_START_ARIOT_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const theirTitan = put(g, 'p2', TITAN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: mine },
        { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs, theirTitan };
}

function chars(g: Game, id: InstanceId): ReturnType<typeof derive> {
  const d = deps(createRegistry([HOW_TO_START_ARIOT_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id);
}

describe('How to Start a Riot', () => {
  test("my creature gains menace; the opponent's creatures get +2/+0; mine is not pumped", () => {
    const { g, mine, theirs, theirTitan } = rioted();
    expect(chars(g, mine).keywords.has('menace')).toBe(true);
    expect(chars(g, mine).power).toBe(2);
    expect(chars(g, theirs).power).toBe(4);
    expect(chars(g, theirs).toughness).toBe(2);
    expect(chars(g, theirTitan).power).toBe(8);
  });

  test('cleanup takes both back (CR 514.2)', () => {
    const { g, mine, theirs } = rioted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(chars(g, mine).keywords.has('menace')).toBe(false);
    expect(chars(g, theirs).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HOW_TO_START_A_RIOT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HOW_TO_START_A_RIOT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HOW_TO_START_A_RIOT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = rioted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
