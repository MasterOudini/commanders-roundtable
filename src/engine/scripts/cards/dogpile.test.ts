// `Dogpile` — two declared attackers make it a 2-point burn, cast in the
// attacker's own post-declaration window.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DOGPILE_SCRIPT } from './dogpile';
import { DOGPILE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function piled(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Dogpile', 'Grizzly Bears', 'Grizzly Bears'], ['Colossal Dreadmaw']],
    scripts: createRegistry([DOGPILE_SCRIPT]),
  });
  const a = put(g, 'p1', 'Grizzly Bears');
  const b = put(g, 'p1', 'Grizzly Bears');
  expect(b).not.toBe(a);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        { card: a, defender: { kind: 'player', id: 'p2' } },
        { card: b, defender: { kind: 'player', id: 'p2' } },
      ],
    }),
  );
  advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', 'Dogpile', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Dogpile', () => {
  test('two attackers burn the face for exactly 2 — read before combat damage lands', () => {
    const { g } = piled();
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DOGPILE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DOGPILE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DOGPILE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = piled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
