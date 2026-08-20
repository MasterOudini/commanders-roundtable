// `Hail Storm` — cast as the DEFENDER mid-combat: the attacker takes 2,
// I take 1, and my own creature takes 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HAIL_STORM_SCRIPT } from './hailStorm';
import { HAIL_STORM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stormed(): { g: Game; attacker: InstanceId; herder: InstanceId; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hail Storm', 'Elvish Herder', 'Colossal Dreadmaw'], ['Grizzly Bears']],
    scripts: createRegistry([HAIL_STORM_SCRIPT]),
  });
  const attacker = put(g, 'p2', 'Grizzly Bears');
  const herder = put(g, 'p1', 'Elvish Herder');
  const dreadmaw = put(g, 'p1', 'Colossal Dreadmaw');
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
  const spell = put(g, 'p1', 'Hail Storm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, attacker, herder, dreadmaw };
}

describe('Hail Storm', () => {
  test('the attacker dies to 2; my 1/1 dies to 1; my 6/6 carries 1; I lose 1', () => {
    const { g, attacker, herder, dreadmaw } = stormed();
    expect(g.state.cards[attacker]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[herder]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[dreadmaw]?.damage).toBe(1);
    expect(g.state.players['p1']?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HAIL_STORM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HAIL_STORM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HAIL_STORM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = stormed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
