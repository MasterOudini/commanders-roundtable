// `Eye Gouge` — the Cyclops takes the debuff AND the destroy; the Bears
// take only the -1/-1 and live at 1/1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EYE_GOUGE_SCRIPT } from './eyeGouge';
import { EYE_GOUGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gouged(name: 'Cyclops of One-Eyed Pass' | 'Grizzly Bears'): {
  g: Game;
  victim: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [['Eye Gouge'], ['Cyclops of One-Eyed Pass', 'Grizzly Bears']],
    scripts: createRegistry([EYE_GOUGE_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Eye Gouge', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Eye Gouge', () => {
  test('a Cyclops is destroyed outright', () => {
    const { g, victim } = gouged('Cyclops of One-Eyed Pass');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('a non-Cyclops takes only the -1/-1 and lives at 1/1', () => {
    const { g, victim } = gouged('Grizzly Bears');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).power).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EYE_GOUGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EYE_GOUGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EYE_GOUGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = gouged('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
