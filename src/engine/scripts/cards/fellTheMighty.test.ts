// `Fell the Mighty` — the bar is the TARGET's derived power, strictly
// greater: Akroma (6) dies over a Bears (2) bar, the second Bears at
// exactly the bar stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FELL_THE_MIGHTY_SCRIPT } from './fellTheMighty';
import { FELL_THE_MIGHTY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; small: InstanceId; peer: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Fell the Mighty', 'Grizzly Bears'], ['Grizzly Bears', 'Akroma, Angel of Wrath']],
    scripts: createRegistry([FELL_THE_MIGHTY_SCRIPT]),
  });
  const small = put(g, 'p1', 'Grizzly Bears');
  const peer = put(g, 'p2', 'Grizzly Bears');
  const big = put(g, 'p2', 'Akroma, Angel of Wrath');
  settle(g);
  const spell = put(g, 'p1', 'Fell the Mighty', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: small }] }));
  settle(g);
  return { g, small, peer, big };
}

describe('Fell the Mighty', () => {
  test('above the bar dies; AT the bar and the bar itself stand', () => {
    const { g, small, peer, big } = board();
    expect(g.state.cards[big]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[peer]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[small]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FELL_THE_MIGHTY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FELL_THE_MIGHTY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FELL_THE_MIGHTY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
