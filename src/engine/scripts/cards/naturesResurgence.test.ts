// `Nature's Resurgence` — two dead creatures draw me two; the opponent's
// one dead creature draws them one, and their dead land counts nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NATURES_RESURGENCE_SCRIPT } from './naturesResurgence';
import { NATURE_S_RESURGENCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function resurged(): { g: Game; mine: number; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ["Nature's Resurgence", 'Grizzly Bears', 'Grizzly Bears'],
      ['Grizzly Bears', 'Mountain'],
    ],
    scripts: createRegistry([NATURES_RESURGENCE_SCRIPT]),
  });
  const a = put(g, 'p1', 'Grizzly Bears');
  const b = put(g, 'p1', 'Grizzly Bears');
  expect(b).not.toBe(a);
  const c = put(g, 'p2', 'Grizzly Bears');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  for (const [player, card] of [['p1', a], ['p1', b], ['p2', c], ['p2', land]] as const) {
    must(
      g.submit({
        t: 'ManualMoveCard',
        player,
        card,
        to: { kind: 'graveyard', player },
      }),
    );
  }
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Nature's Resurgence", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mine = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mine, theirs };
}

describe("Nature's Resurgence", () => {
  test('two dead creatures draw me two; their one draws them one', () => {
    const { g, mine, theirs } = resurged();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine + 2);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NATURE_S_RESURGENCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NATURE_S_RESURGENCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NATURE_S_RESURGENCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = resurged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
