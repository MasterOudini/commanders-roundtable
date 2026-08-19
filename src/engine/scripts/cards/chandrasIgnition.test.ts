// `Chandra's Ignition` — one source, the whole table: each OTHER creature
// and each OPPONENT takes the source's power; the source itself and its
// caster take nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CHANDRAS_IGNITION_SCRIPT } from './chandrasIgnition';
import { CHANDRA_S_IGNITION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ignite(): { g: Game; big: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ["Chandra's Ignition", 'Colossal Dreadmaw', 'Grizzly Bears'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([CHANDRAS_IGNITION_SCRIPT]),
  });
  const big = put(g, 'p1', 'Colossal Dreadmaw');
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', "Chandra's Ignition", 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: big }] }));
  settle(g);
  return { g, big, mine, theirs };
}

describe("Chandra's Ignition", () => {
  test('both Bears die (mine included), the source stands, the opponent takes 6, I take 0', () => {
    const { g, big, mine, theirs } = ignite();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(34);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CHANDRA_S_IGNITION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CHANDRA_S_IGNITION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CHANDRA_S_IGNITION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ignite();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
