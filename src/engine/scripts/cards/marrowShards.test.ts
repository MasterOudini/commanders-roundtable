// `Marrow Shards` — cast as the defender for plain {W}: the attacking
// 1/1 dies, the stay-at-home is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MARROW_SHARDS_SCRIPT } from './marrowShards';
import { MARROW_SHARDS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sharded(): { g: Game; attacker: InstanceId; home: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Marrow Shards'], ['Elvish Herder', 'Grizzly Bears']],
    scripts: createRegistry([MARROW_SHARDS_SCRIPT]),
  });
  const attacker = put(g, 'p2', 'Elvish Herder');
  const home = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [{ card: attacker, defender: { kind: 'player', id: 'p1' } }],
    }),
  );
  advanceUntil(
    g,
    (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0,
    20_000,
  );
  const spell = put(g, 'p1', 'Marrow Shards', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, attacker, home };
}

describe('Marrow Shards', () => {
  test('the attacking 1/1 dies to 1; the creature at home is untouched', () => {
    const { g, attacker, home } = sharded();
    expect(g.state.cards[attacker]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[home]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[home]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MARROW_SHARDS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MARROW_SHARDS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MARROW_SHARDS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sharded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
