// `Tremor` — 1 to each non-flyer, so the flyer walks away untouched and a
// 1-toughness ground creature dies to the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TREMOR_SCRIPT } from './tremor';
import { TREMOR } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Tremor';
const FLYER = 'Air Elemental'; // 4/4 flying
const GROUND = 'Grizzly Bears'; // 2/2 no flying
const TINY = 'Darksteel Myr'; // 0/1 — indestructible, so damage alone will not bin it
const MOGG = 'Mogg Raider'; // 1/1 ground, dies to 1

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shaken(): { g: Game; flyer: InstanceId; ground: InstanceId; mogg: InstanceId } {
  const g = startedGame({
    players: 2,
    // ⚠️ MOGG is listed in p2's deck too: put() fetches from the named
    // player's OWN list (D232).
    decks: [[SPELL, FLYER, GROUND, TINY], [MOGG]],
    scripts: createRegistry([TREMOR_SCRIPT]),
  });
  const flyer = put(g, 'p1', FLYER);
  const ground = put(g, 'p1', GROUND);
  const mogg = put(g, 'p2', MOGG);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, flyer, ground, mogg };
}

describe('Tremor', () => {
  test('the flyer takes NOTHING, the ground creatures take 1, and the 1/1 dies', () => {
    const { g, flyer, ground, mogg } = shaken();
    expect(g.state.cards[flyer]?.damage).toBe(0);
    expect(g.state.cards[ground]?.damage).toBe(1);
    expect(g.state.cards[ground]?.zone.kind).toBe('battlefield');
    // Any controller's non-flyer is hit — the card says "each".
    expect(g.state.cards[mogg]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TREMOR.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TREMOR.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TREMOR.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = shaken();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
