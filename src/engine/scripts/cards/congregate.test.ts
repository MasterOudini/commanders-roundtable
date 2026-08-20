// `Congregate` — 2 per creature ANYWHERE, at the chosen player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CONGREGATE_SCRIPT } from './congregate';
import { CONGREGATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function congregated(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Congregate', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([CONGREGATE_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Congregate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] }));
  settle(g);
  return g;
}

describe('Congregate', () => {
  test('two creatures — one THEIRS — pay 4 to the chosen player', () => {
    const g = congregated();
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CONGREGATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CONGREGATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CONGREGATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = congregated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
