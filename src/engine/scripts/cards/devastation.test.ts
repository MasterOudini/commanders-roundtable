// `Devastation` — creatures and lands fall together; the indestructible
// artifact land stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEVASTATION_SCRIPT } from './devastation';
import { DEVASTATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ruined(): { g: Game; bears: InstanceId; land: InstanceId; citadel: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Devastation'], ['Grizzly Bears', 'Mountain', 'Darksteel Citadel']],
    scripts: createRegistry([DEVASTATION_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const land = put(g, 'p2', 'Mountain');
  const citadel = put(g, 'p2', 'Darksteel Citadel');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Devastation', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 7 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, land, citadel };
}

describe('Devastation', () => {
  test('the creature and the land die; Darksteel Citadel stands', () => {
    const { g, bears, land, citadel } = ruined();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[citadel]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEVASTATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEVASTATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEVASTATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ruined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
