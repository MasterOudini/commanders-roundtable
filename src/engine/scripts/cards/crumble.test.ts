// `Crumble` — the artifact dies and ITS controller gains its mana value.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CRUMBLE_SCRIPT } from './crumble';
import { CRUMBLE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function crumbled(): { g: Game; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Crumble'], ['Sol Ring']],
    scripts: createRegistry([CRUMBLE_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Crumble', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
  settle(g);
  return { g, ring };
}

describe('Crumble', () => {
  test('the Ring (mv 1) dies and its controller gains 1', () => {
    const { g, ring } = crumbled();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(41);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CRUMBLE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CRUMBLE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CRUMBLE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = crumbled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
