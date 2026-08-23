// `Tsunami` — the subtype wipe on lands: every Island goes, whoever controls
// it, and a Mountain stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TSUNAMI_SCRIPT } from './tsunami';
import { TSUNAMI } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Tsunami';
const ISLAND = 'Island';
const MOUNTAIN = 'Mountain';
const CITADEL = 'Darksteel Citadel'; // an INDESTRUCTIBLE land, and not an Island

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drowned(): {
  g: Game;
  mine: InstanceId;
  theirs: InstanceId;
  mountain: InstanceId;
  citadel: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ISLAND, MOUNTAIN, CITADEL], [ISLAND]],
    scripts: createRegistry([TSUNAMI_SCRIPT]),
  });
  const mine = put(g, 'p1', ISLAND);
  const mountain = put(g, 'p1', MOUNTAIN);
  const citadel = put(g, 'p1', CITADEL);
  const theirs = put(g, 'p2', ISLAND);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, mountain, citadel };
}

describe('Tsunami', () => {
  test('every Island dies — mine included — and the other lands stand', () => {
    const { g, mine, theirs, mountain, citadel } = drowned();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mountain]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[citadel]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TSUNAMI.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TSUNAMI.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TSUNAMI.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = drowned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
