// `Ghoul's Feast` — +X/+0 where X counts creature CARDS in my graveyard;
// the Sol Ring in there counts for nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GHOULS_FEAST_SCRIPT } from './ghoulsFeast';
import { GHOUL_S_FEAST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function feasted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ["Ghoul's Feast", 'Grizzly Bears', 'Grizzly Bears', 'Elvish Herder', 'Sol Ring'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([GHOULS_FEAST_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const dead = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  expect(dead).not.toBe(bears);
  put(g, 'p1', 'Elvish Herder', 'graveyard');
  put(g, 'p1', 'Sol Ring', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Ghoul's Feast", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe("Ghoul's Feast", () => {
  test('two dead creatures make the 2/2 a 4/2; the artifact card counts nothing', () => {
    const { g, bears } = feasted();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(2);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GHOUL_S_FEAST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GHOUL_S_FEAST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GHOUL_S_FEAST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = feasted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
