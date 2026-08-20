// The D199 noun-list widening: two more comma-or compounds in Icy
// Manipulator's exact idiom. `Bedevil` — REFUSED since D192 as the class's
// founding card — is a VOCABULARY card the moment the parse reads it: no
// script anywhere, the whole text one admitted destroy.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { parseTargetClauses } from '../data/targetParse';
import { parseEffects } from '../data/effectParse';
import { SHIPPED_REGISTRY } from './scripts/registry';
import { BEDEVIL } from '../data/fixtures/engineCards';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('the widened noun lists (D199)', () => {
  test('both compounds parse to their three ENFORCED kinds', () => {
    const bedevil = parseTargetClauses(BEDEVIL.faces[0]?.oracleText ?? '');
    expect(bedevil[0]?.kinds).toEqual(['artifact', 'creature', 'planeswalker']);
    expect(bedevil[0]?.unenforced).toEqual([]);
    const decree = parseTargetClauses(
      "Put target artifact, creature, or enchantment on top of its owner's library.",
    );
    expect(decree[0]?.kinds).toEqual(['artifact', 'creature', 'enchantment']);
  });

  test('Bedevil is a VOCABULARY card — auto, and no script may shadow it', () => {
    expect(parseEffects(BEDEVIL.faces[0]?.oracleText ?? '', BEDEVIL.name, true).mode).toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BEDEVIL.oracleId)).toBeUndefined();
  });

  test('Bedevil destroys an artifact end to end and replays', () => {
    const g = startedGame({ players: 2, decks: [['Bedevil'], ['Sol Ring']] });
    const ring = put(g, 'p2', 'Sol Ring');
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const spell = put(g, 'p1', 'Bedevil', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
