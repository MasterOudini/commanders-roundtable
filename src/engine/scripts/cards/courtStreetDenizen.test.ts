// `Court Street Denizen` — the colour-filtered enters-trigger with a TARGET:
// a white creature entering raises the prompt, a green one raises nothing,
// and a white TOKEN counts (the two-def rule).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COURT_STREET_DENIZEN_SCRIPT } from './courtStreetDenizen';
import { SOLDIER_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DENIZEN = 'Court Street Denizen';
const GRIFFIN = 'Courier Griffin';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; denizen: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DENIZEN, GRIFFIN, BEARS], [BEARS]],
    scripts: createRegistry([COURT_STREET_DENIZEN_SCRIPT]),
  });
  const denizen = put(g, 'p1', DENIZEN);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  return { g, denizen, theirs };
}

describe('Court Street Denizen', () => {
  test('a WHITE creature entering asks for a target, and the answer taps it', () => {
    const { g, theirs } = game();
    put(g, 'p1', GRIFFIN);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('a GREEN creature entering raises nothing', () => {
    const { g } = game();
    const logAt = g.log.length;
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'AbilityPutOnStack')).toBe(false);
  });

  test('a white TOKEN counts — the TokenCreated def fires too', () => {
    const { g, theirs } = game();
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = game();
    put(g, 'p1', GRIFFIN);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
