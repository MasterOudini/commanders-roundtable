// `Peer Past the Veil` — the discarded hand joins the census; the spell
// itself is still on the stack and does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PEER_PAST_THE_VEIL_SCRIPT } from './peerPastTheVeil';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function peered(handNames: readonly string[], graveNames: readonly string[]): Game {
  const g = startedGame({
    players: 2,
    decks: [['Peer Past the Veil', 'Grizzly Bears', 'Sol Ring'], []],
    scripts: createRegistry([PEER_PAST_THE_VEIL_SCRIPT]),
  });
  // The listed nonbasics either join the hand under test or go to exile —
  // never the seeded opening hand, where they would skew the type census.
  for (const name of ['Grizzly Bears', 'Sol Ring']) {
    if (!handNames.includes(name)) put(g, 'p1', name, 'exile');
  }
  for (const name of handNames) put(g, 'p1', name, 'hand');
  for (const name of graveNames) put(g, 'p1', name, 'graveyard');
  settle(g);
  const spell = put(g, 'p1', 'Peer Past the Veil', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['R', 'G', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Peer Past the Veil', () => {
  test('discards the hand and draws one card per type across grave and discards', () => {
    // Hand: a creature + an artifact + the opening hand's leftover basics
    // (all Lands). Graveyard: a land, so the basics add no new type. The
    // resolving sorcery is on the stack during the census — three types.
    const g = peered(['Grizzly Bears', 'Sol Ring'], ['Island']);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(3);
    const grave = (g.state.zones.graveyard['p1'] ?? []).map((id) => nameOf(g, id));
    expect(grave).toContain('Sol Ring');
    expect(grave).toContain('Peer Past the Veil');
  });

  test('a hand of nothing but basics is one type and one draw', () => {
    // The opening hand minus the cast spell is six padded basic lands —
    // the census reads {Land} and nothing else.
    const g = peered([], []);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = peered(['Grizzly Bears'], []);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
