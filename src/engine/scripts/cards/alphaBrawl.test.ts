// `Alpha Brawl` — the melee: the target hits its whole side, they all hit
// back, and every mark lands before the state-based sweep kills anything.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ALPHA_BRAWL_SCRIPT } from './alphaBrawl';
import { ALPHA_BRAWL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function brawl(): { g: Game; big: InstanceId; small: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Alpha Brawl'], ['Colossal Dreadmaw', 'Grizzly Bears']],
    scripts: createRegistry([ALPHA_BRAWL_SCRIPT]),
  });
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  const small = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Alpha Brawl', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 8 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: big }] }));
  settle(g);
  return { g, big, small };
}

describe('Alpha Brawl', () => {
  test('the Dreadmaw flattens the Bears and takes their 2 back — both waves marked', () => {
    const { g, big, small } = brawl();
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
    const waves = g.log.filter((e) => e.body.t === 'DamageDealt');
    expect(waves.length).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ALPHA_BRAWL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ALPHA_BRAWL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ALPHA_BRAWL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = brawl();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
