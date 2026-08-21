// `Swirling Sandstorm` — the THRESHOLD conditional: below seven cards in my
// graveyard the spell is a true no-op; at seven it sweeps everything without
// flying, on both boards.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SWIRLING_SANDSTORM_SCRIPT } from './swirlingSandstorm';
import { SWIRLING_SANDSTORM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Swirling Sandstorm';
const BEARS = 'Grizzly Bears';
const FLYER = 'Air Elemental';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swept(buried: number): { g: Game; ground: InstanceId; flyer: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, FLYER], []],
    scripts: createRegistry([SWIRLING_SANDSTORM_SCRIPT]),
  });
  const ground = put(g, 'p1', BEARS);
  const flyer = put(g, 'p1', FLYER);
  settle(g);
  // Fill the graveyard from the library, one Manual move at a time.
  const lib = [...(g.state.zones.library['p1'] ?? [])];
  for (let i = 0; i < buried; i++) {
    const card = lib[i];
    if (!card) throw new Error('the padded library must hold enough cards to bury');
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'graveyard', player: 'p1' } }),
    );
  }
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, ground, flyer };
}

describe('Swirling Sandstorm', () => {
  test('at SEVEN the ground creature dies and the flyer stands', () => {
    const { g, ground, flyer } = swept(7);
    expect(g.state.cards[ground]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flyer]?.zone.kind).toBe('battlefield');
  });

  test('below threshold it does nothing at all', () => {
    const { g, ground, flyer } = swept(6);
    expect(g.state.cards[ground]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[flyer]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SWIRLING_SANDSTORM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SWIRLING_SANDSTORM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SWIRLING_SANDSTORM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swept(7);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
