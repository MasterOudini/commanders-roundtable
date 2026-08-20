// `Flicker of Fate` — the enchantment leaves and comes straight back,
// still on the battlefield with its owner.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLICKER_OF_FATE_SCRIPT } from './flickerOfFate';
import { FLICKER_OF_FATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flickered(): { g: Game; flame: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Flicker of Fate', 'Captive Flame'], ['Grizzly Bears']],
    scripts: createRegistry([FLICKER_OF_FATE_SCRIPT]),
  });
  const flame = put(g, 'p1', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flicker of Fate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: flame }] }));
  settle(g);
  return { g, flame };
}

describe('Flicker of Fate', () => {
  test('the enchantment leaves and returns to the battlefield', () => {
    const { g, flame } = flickered();
    expect(g.state.cards[flame]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[flame]?.controller).toBe('p1');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLICKER_OF_FATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLICKER_OF_FATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLICKER_OF_FATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flickered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
