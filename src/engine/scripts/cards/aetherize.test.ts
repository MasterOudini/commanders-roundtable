// `Aetherize` — the whole attack vanishes into its owner's hand, at instant
// speed, mid-combat: the first combat-state wipe.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AETHERIZE_SCRIPT } from './aetherize';
import { AETHERIZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function midAttack(): { g: Game; attacker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Aetherize'], ['Grizzly Bears']],
    scripts: createRegistry([AETHERIZE_SCRIPT]),
  });
  const attacker = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  // BOTH seats held: p2 so its declaration waits for the script, and p1 so
  // the priority window with the attack declared is not auto-passed away.
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
  // The defender gets priority with the attack declared — cast at instant speed.
  advanceUntil(
    g,
    (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0,
    20_000,
  );
  const spell = put(g, 'p1', 'Aetherize', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, attacker };
}

describe('Aetherize', () => {
  test('the attacker goes home to its owner HAND mid-combat', () => {
    const { g, attacker } = midAttack();
    expect(g.state.cards[attacker]?.zone.kind).toBe('hand');
    expect(g.state.cards[attacker]?.zone.kind === 'hand' && (g.state.zones.hand['p2'] ?? []).includes(attacker)).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AETHERIZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AETHERIZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AETHERIZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = midAttack();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
