// `Mercadia's Downfall` — one nonbasic land behind the defender is +1/+0;
// the basic Mountain beside it counts nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MERCADIAS_DOWNFALL_SCRIPT } from './mercadiasDownfall';
import { MERCADIA_S_DOWNFALL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function downfallen(): Game {
  const g = startedGame({
    players: 2,
    decks: [["Mercadia's Downfall", 'Grizzly Bears'], ['Darksteel Citadel', 'Mountain']],
    scripts: createRegistry([MERCADIAS_DOWNFALL_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  put(g, 'p2', 'Darksteel Citadel');
  put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(
    g,
    (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0,
    20_000,
  );
  const spell = put(g, 'p1', "Mercadia's Downfall", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe("Mercadia's Downfall", () => {
  test('the attacker hits for 2+1 — one nonbasic land, the basic uncounted', () => {
    const g = downfallen();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MERCADIA_S_DOWNFALL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MERCADIA_S_DOWNFALL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MERCADIA_S_DOWNFALL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = downfallen();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
