// `Crookclaw Elder` — two Birds (itself and the Aven) tap to draw; two
// Wizards (itself and Azami) tap to give my bear flying until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CROOKCLAW_ELDER_SCRIPT } from './crookclawElder';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ELDER = 'Crookclaw Elder';
const AVEN = 'Aven Fateshaper';
const AZAMI = 'Azami, Lady of Scrolls';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function keywords(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([CROOKCLAW_ELDER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function placed(): { g: Game; elder: InstanceId; aven: InstanceId; azami: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ELDER, AVEN, AZAMI, BEARS], []],
    scripts: createRegistry([CROOKCLAW_ELDER_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const aven = put(g, 'p1', AVEN);
  const azami = put(g, 'p1', AZAMI);
  const elder = put(g, 'p1', ELDER);
  settle(g);
  return { g, elder, aven, azami, bears };
}

describe('Crookclaw Elder', () => {
  test('two Birds tap: a card', () => {
    const { g, elder, aven } = placed();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: elder, abilityIndex: 0, tap: [elder, aven], targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('two Wizards tap: the bear flies until cleanup', () => {
    const { g, elder, azami, bears } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: elder, abilityIndex: 1, tap: [elder, azami] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(keywords(g, bears).has('flying')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(keywords(g, bears).has('flying')).toBe(false);
  });

  test('Azami is not a Bird', () => {
    const { g, elder, azami } = placed();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: elder, abilityIndex: 0, tap: [elder, azami], targets: [] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, elder, aven } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: elder, abilityIndex: 0, tap: [elder, aven], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
