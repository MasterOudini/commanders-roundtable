// `Inspired Ultimatum` — I gain 5, the opponent takes 5, and five cards
// arrive: three riders off two arrows.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INSPIRED_ULTIMATUM_SCRIPT } from './inspiredUltimatum';
import { INSPIRED_ULTIMATUM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ultimated(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Inspired Ultimatum'], ['Grizzly Bears']],
    scripts: createRegistry([INSPIRED_ULTIMATUM_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Inspired Ultimatum', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'player', id: 'p1' },
        { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return { g, mid };
}

describe('Inspired Ultimatum', () => {
  test('I gain 5, they take 5, I draw five', () => {
    const { g, mid } = ultimated();
    expect(g.state.players['p1']?.life).toBe(45);
    expect(g.state.players['p2']?.life).toBe(35);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 5);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INSPIRED_ULTIMATUM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INSPIRED_ULTIMATUM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INSPIRED_ULTIMATUM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ultimated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
