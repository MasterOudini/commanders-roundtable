// `Eternal Isolation` — the D139 floor at the aim and the BOTTOM placement:
// the removed threat sits at index 0, under everything.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ETERNAL_ISOLATION_SCRIPT } from './eternalIsolation';
import { ETERNAL_ISOLATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; big: InstanceId; small: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Eternal Isolation'], ['Colossal Dreadmaw', 'Grizzly Bears']],
    scripts: createRegistry([ETERNAL_ISOLATION_SCRIPT]),
  });
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  const small = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Eternal Isolation', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, big, small };
}

describe('Eternal Isolation', () => {
  test('a 2-power target is REFUSED at the aim (D139), the 6-power one goes UNDER the library', () => {
    const { g, big, small } = board();
    const refused = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: small }] });
    expect(refused.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: big }] }));
    settle(g);
    expect(g.state.cards[big]?.zone.kind).toBe('library');
    expect(g.state.zones.library['p2']?.[0]).toBe(big);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ETERNAL_ISOLATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ETERNAL_ISOLATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ETERNAL_ISOLATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, big } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: big }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
