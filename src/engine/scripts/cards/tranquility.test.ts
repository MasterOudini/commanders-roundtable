// `Tranquility` — the unfiltered twin: on the SAME board Tranquil Domain
// spares the Aura and this one takes it, which is what makes the other card's
// negation an assertion rather than a claim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TRANQUILITY_SCRIPT } from './tranquility';
import { TRANQUILITY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Tranquility';
const AURA = 'Pacifism';
const GLOBAL = "Ajani's Welcome";
const HOST = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swept(): { g: Game; aura: InstanceId; global: InstanceId; host: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, AURA, GLOBAL, HOST], []],
    scripts: createRegistry([TRANQUILITY_SCRIPT]),
  });
  const host = put(g, 'p1', HOST);
  const global = put(g, 'p1', GLOBAL);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);

  const aura = put(g, 'p1', AURA, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: host }] }));
  settle(g);

  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, aura, global, host };
}

describe('Tranquility', () => {
  test('BOTH enchantments die — the Aura included — and the creature stands', () => {
    const { g, aura, global, host } = swept();
    expect(g.state.cards[global]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[aura]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[host]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TRANQUILITY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TRANQUILITY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TRANQUILITY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
