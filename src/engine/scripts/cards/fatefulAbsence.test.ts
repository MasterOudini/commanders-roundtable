// `Fateful Absence` — the creature dies and its controller gets the Clue.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FATEFUL_ABSENCE_SCRIPT } from './fatefulAbsence';
import { FATEFUL_ABSENCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function absented(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Fateful Absence'], ['Grizzly Bears']],
    scripts: createRegistry([FATEFUL_ABSENCE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fateful Absence', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

function cluesOf(g: Game, player: 'p1' | 'p2'): number {
  let n = 0;
  for (const id of g.state.zones.battlefield) {
    const card = g.state.cards[id];
    if (!card || card.controller !== player || !card.isToken) continue;
    if (g.deps.oracle.byPrinting(card.printingId)?.name === 'Clue') n++;
  }
  return n;
}

describe('Fateful Absence', () => {
  test('the creature dies; its controller gets ONE Clue', () => {
    const { g, bears } = absented();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(cluesOf(g, 'p2')).toBe(1);
    expect(cluesOf(g, 'p1')).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FATEFUL_ABSENCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FATEFUL_ABSENCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FATEFUL_ABSENCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = absented();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
