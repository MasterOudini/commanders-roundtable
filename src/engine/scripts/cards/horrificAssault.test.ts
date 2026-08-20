// `Horrific Assault` — the bite either way; the 3 life only behind an
// Eldrazi.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HORRIFIC_ASSAULT_SCRIPT } from './horrificAssault';
import { HORRIFIC_ASSAULT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function assaulted(eldrazi: boolean): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Horrific Assault', 'Colossal Dreadmaw', 'Desolation Twin'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([HORRIFIC_ASSAULT_SCRIPT]),
  });
  const dreadmaw = put(g, 'p1', 'Colossal Dreadmaw');
  if (eldrazi) put(g, 'p1', 'Desolation Twin');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Horrific Assault', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: dreadmaw },
        { kind: 'card', id: bears },
      ],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Horrific Assault', () => {
  test('no Eldrazi: the bite lands, no life', () => {
    const { g, bears } = assaulted(false);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('with the 10/10 Eldrazi standing by: the bite AND the 3 life', () => {
    const { g, bears } = assaulted(true);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HORRIFIC_ASSAULT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HORRIFIC_ASSAULT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HORRIFIC_ASSAULT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = assaulted(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
