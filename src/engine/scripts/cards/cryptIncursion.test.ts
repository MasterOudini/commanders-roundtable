// `Crypt Incursion` — the target's creature CARDS are exiled and the
// caster gains 3 each; the noncreature stays put.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CRYPT_INCURSION_SCRIPT } from './cryptIncursion';
import { CRYPT_INCURSION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function incursion(): { g: Game; a: InstanceId; b: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Crypt Incursion'], ['Grizzly Bears', 'Grizzly Bears', 'Mountain']],
    scripts: createRegistry([CRYPT_INCURSION_SCRIPT]),
  });
  const a = put(g, 'p2', 'Grizzly Bears', 'graveyard');
  const b = put(g, 'p2', 'Grizzly Bears', 'graveyard');
  const land = put(g, 'p2', 'Mountain', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Crypt Incursion', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, a, b, land };
}

describe('Crypt Incursion', () => {
  test('both dead creatures exiled for 6 life; the land stays', () => {
    const { g, a, b, land } = incursion();
    expect(g.state.cards[a]?.zone.kind).toBe('exile');
    expect(g.state.cards[b]?.zone.kind).toBe('exile');
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(46);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CRYPT_INCURSION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CRYPT_INCURSION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CRYPT_INCURSION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = incursion();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
