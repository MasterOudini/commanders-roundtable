// `War Report` — "plus", not "or": an ARTIFACT CREATURE counts twice.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WAR_REPORT_SCRIPT } from './warReport';
import { WAR_REPORT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'War Report';
const BEARS = 'Grizzly Bears'; // creature
const RING = 'Sol Ring'; // artifact
const SERVANT = 'Voltaic Servant'; // ARTIFACT CREATURE — counts twice

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(mine: string[], theirs: string[]): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, BEARS, RING, SERVANT],
      [BEARS, RING],
    ],
    scripts: createRegistry([WAR_REPORT_SCRIPT]),
  });
  for (const n of mine) put(g, 'p1', n);
  for (const n of theirs) put(g, 'p2', n);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('War Report', () => {
  test('one creature and one artifact of mine gain 2', () => {
    const g = cast([BEARS, RING], []);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('an ARTIFACT CREATURE counts TWICE', () => {
    const g = cast([SERVANT], []);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test("the OPPONENT's board counts too — the line says the battlefield", () => {
    const g = cast([], [BEARS, RING]);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WAR_REPORT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WAR_REPORT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WAR_REPORT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast([BEARS, RING], []);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
