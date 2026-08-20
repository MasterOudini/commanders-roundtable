// `Nurgle's Conscription` — the creature arrives TAPPED under MY control
// and the rest of that graveyard is exiled.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NURGLES_CONSCRIPTION_SCRIPT } from './nurglesConscription';
import { NURGLE_S_CONSCRIPTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function conscripted(): { g: Game; bears: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Nurgle's Conscription"], ['Grizzly Bears', 'Mountain']],
    scripts: createRegistry([NURGLES_CONSCRIPTION_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  for (const card of [bears, land]) {
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p2',
        card,
        to: { kind: 'graveyard', player: 'p2' },
      }),
    );
  }
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Nurgle's Conscription", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears, land };
}

describe("Nurgle's Conscription", () => {
  test('the Bears arrives TAPPED under my control; the rest is exiled', () => {
    const { g, bears, land } = conscripted();
    const card = g.state.cards[bears];
    expect(card?.zone.kind).toBe('battlefield');
    expect(card?.controller).toBe('p1');
    expect(card?.tapped).toBe(true);
    expect(g.state.cards[land]?.zone.kind).toBe('exile');
    expect((g.state.zones.graveyard['p2'] ?? []).length).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NURGLE_S_CONSCRIPTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NURGLE_S_CONSCRIPTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NURGLE_S_CONSCRIPTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = conscripted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
