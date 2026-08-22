// `Temporal Machinations` — the bounce always; the draw only behind an
// artifact I control. The draw is counted off the `DrewCards` marker (D189),
// because the cast itself moves a card out of the hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TEMPORAL_MACHINATIONS_SCRIPT } from './temporalMachinations';
import { TEMPORAL_MACHINATIONS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Temporal Machinations';
const RING = 'Sol Ring';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(withArtifact: boolean): { g: Game; bears: InstanceId; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, RING], [BEARS]],
    scripts: createRegistry([TEMPORAL_MACHINATIONS_SCRIPT]),
  });
  if (withArtifact) put(g, 'p1', RING);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  let drew = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') drew += body.cards.length;
  }
  return { g, bears, drew };
}

describe('Temporal Machinations', () => {
  test('with an artifact out: the bounce AND the draw', () => {
    const { g, bears, drew } = cast(true);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(drew).toBe(1);
  });

  test('with NO artifact: the bounce alone', () => {
    const { g, bears, drew } = cast(false);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(drew).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TEMPORAL_MACHINATIONS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TEMPORAL_MACHINATIONS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TEMPORAL_MACHINATIONS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
