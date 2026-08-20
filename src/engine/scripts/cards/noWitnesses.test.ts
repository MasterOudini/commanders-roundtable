// `No Witnesses` — the most-creatures player Clues up, then everyone dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NO_WITNESSES_SCRIPT } from './noWitnesses';
import { NO_WITNESSES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function clues(g: Game, seat: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken || card.controller !== seat) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Clue';
  }).length;
}

function witnessed(): { g: Game; a: InstanceId; b: InstanceId; c: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['No Witnesses', 'Grizzly Bears', 'Aysen Bureaucrats'], ['Grizzly Bears']],
    scripts: createRegistry([NO_WITNESSES_SCRIPT]),
  });
  const a = put(g, 'p1', 'Grizzly Bears');
  const b = put(g, 'p1', 'Aysen Bureaucrats');
  const c = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'No Witnesses', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, a, b, c };
}

describe('No Witnesses', () => {
  test('the most-creatures player gets the Clue; everyone dies', () => {
    const { g, a, b, c } = witnessed();
    expect(clues(g, 'p1')).toBe(1);
    expect(clues(g, 'p2')).toBe(0);
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[c]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NO_WITNESSES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NO_WITNESSES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NO_WITNESSES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = witnessed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
