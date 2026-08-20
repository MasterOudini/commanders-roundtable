// `Olivia's Wrath` — two Vampires make X=2: the non-Vampire 2/2 dies and
// the Vampires are exempt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { OLIVIAS_WRATH_SCRIPT } from './oliviasWrath';
import { OLIVIA_S_WRATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function wrathed(): { g: Game; mavren: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Olivia's Wrath", 'Mavren Fein, Dusk Apostle'], ['Grizzly Bears']],
    scripts: createRegistry([OLIVIAS_WRATH_SCRIPT]),
  });
  const mavren = put(g, 'p1', 'Mavren Fein, Dusk Apostle');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const vampire = g.deps.oracle.byName?.('Vampire');
  if (!vampire?.printingId) throw new Error('no Vampire token printing in the test oracle');
  must(
    g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: vampire.printingId, count: 1 }),
  );
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Olivia's Wrath", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mavren, bears };
}

describe("Olivia's Wrath", () => {
  test('X=2 kills the non-Vampire 2/2; the Vampires stand', () => {
    const { g, mavren, bears } = wrathed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mavren]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = OLIVIA_S_WRATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, OLIVIA_S_WRATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(OLIVIA_S_WRATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = wrathed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
