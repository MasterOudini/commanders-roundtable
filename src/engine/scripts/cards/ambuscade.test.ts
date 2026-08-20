// `Ambuscade` — the bite reads the power AFTER the +1/+0: the log's damage
// entry says 3, which no pre-pump read could produce from a 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AMBUSCADE_SCRIPT } from './ambuscade';
import { AMBUSCADE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Ambuscade', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([AMBUSCADE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Ambuscade', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Ambuscade', () => {
  test('the bite is THREE from a 2/2 — the pump landed first', () => {
    const { g, mine, theirs } = cast();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    const bites = g.log.filter(
      (e) => e.body.t === 'DamageDealt' && e.body.damages.some((d) => d.amount === 3 && d.source === mine),
    );
    expect(bites.length).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AMBUSCADE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AMBUSCADE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AMBUSCADE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
