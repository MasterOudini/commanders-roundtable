// `Chaotic Backlash` — 2 × the target's WHITE-or-BLUE permanents: one white
// creature + one green = 2 damage.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CHAOTIC_BACKLASH_SCRIPT } from './chaoticBacklash';
import { CHAOTIC_BACKLASH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function backlashed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Chaotic Backlash'], ['Angelheart Protector', 'Grizzly Bears']],
    scripts: createRegistry([CHAOTIC_BACKLASH_SCRIPT]),
  });
  put(g, 'p2', 'Angelheart Protector');
  put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Chaotic Backlash', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Chaotic Backlash', () => {
  test('one white + one green permanent pays 2 (only the white counts, doubled)', () => {
    const g = backlashed();
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CHAOTIC_BACKLASH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CHAOTIC_BACKLASH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CHAOTIC_BACKLASH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = backlashed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
