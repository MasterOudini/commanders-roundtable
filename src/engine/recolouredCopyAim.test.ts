// COPY TO: src/engine/recolouredCopyAim.test.ts (imports are relative to src/engine/).
//
// D587 - A RECOLOURED SPELL COPY IS AIMED IN THE COPY'S COLOURS BY EVERY AIMER (FIX-LIST 14 - the review's X8 / stc-2).
// Fork's copy is red (CR 707.9b / 707.10). D586 carries that red on its reflexive trigger's aim (`sourceColors` - CR 603.12
// and 603.7d: the trigger a spell makes has that spell, the copy, as its source) and the host aims with it; D487's host aims
// a copy's new targets (CR 707.10c) with the copy's own colours too. The test harness's answer (`sourceOf` - what every
// `advanceUntil` submits) aimed both with the copied CARD's printed face and so picked what the host refuses: on D586's own
// board - p2's pro-red Kor Firewalker and pro-blue Scragnoth (CR 702.16b) - the red copy's trigger was aimed at Kor and
// `answer()` threw (D586's own test answers that aim by hand). Proven here: `advanceUntil` drives a Fork copy of Faebloom
// Trick through both aims - Scragnoth for the red copy's trigger, Kor for the blue original's; a copy's new-targets question
// now carries the copy's colours (Fork's red; Reverberate's copy has none of its own - its question as before) and the harness
// re-aims the red copy at Scragnoth. The replay hash on each. The client veil, the net driver and the bot are proven over a
// real host in src/net/recolouredCopyVeil.test.ts and src/bot/botRecolouredCopy.test.ts.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { EventBody } from './types/events';
import type { StackId } from './types/ids';
import type { TargetChoice } from './types/state';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const since = (g: Game, at: number): EventBody[] => g.log.slice(at).map((e) => e.body);
const mana = (g: Game, symbol: 'U' | 'R', amount: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));

function top(g: Game): StackId {
  const id = g.state.stack[g.state.stack.length - 1]?.id;
  if (id === undefined) throw new Error('the stack is empty');
  return id;
}

/** The reflexive trigger asked for its aim since `at`: the recoloured copy's (its question carries `sourceColors`) or the original's. */
function triggerAsked(g: Game, at: number, recoloured: boolean): StackId | undefined {
  for (const b of since(g, at)) {
    if (b.t === 'AwaitingSet' && b.awaiting?.kind === 'chooseTargets' && b.awaiting.forKind === 'trigger' && (b.awaiting.sourceColors !== undefined) === recoloured) return b.awaiting.stackId;
  }
  return undefined;
}

/** The targets the answer gave a stack object since `at`. */
function aimOf(g: Game, at: number, stackId: StackId): readonly TargetChoice[] | undefined {
  for (const b of since(g, at)) if (b.t === 'StackTargetsSet' && b.stackId === stackId) return b.targets;
  return undefined;
}

describe('D587 - a recoloured spell copy is aimed in its own colours (the harness)', () => {
  test("advanceUntil drives a Fork copy of Faebloom Trick through both aims: the red copy's trigger at Scragnoth, the blue original's at Kor", () => {
    const g = startedGame({ players: 2, decks: [['Faebloom Trick', 'Fork'], ['Kor Firewalker', 'Scragnoth']] });
    holdEverywhere(g);
    const trick = put(g, 'p1', 'Faebloom Trick', 'hand');
    const fork = put(g, 'p1', 'Fork', 'hand');
    const kor = put(g, 'p2', 'Kor Firewalker');
    const scrag = put(g, 'p2', 'Scragnoth');
    main3(g);
    mana(g, 'U', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: trick, targets: [] }));
    const trickObj = top(g);
    mana(g, 'R', 2);
    const at = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: fork, targets: [{ kind: 'stack', id: trickObj }] }));
    // Every question answered the harness's way, both aims included - before the fix the first one threw here.
    settle(g);
    const red = triggerAsked(g, at, true);
    const blue = triggerAsked(g, at, false);
    if (red === undefined || blue === undefined) throw new Error('the two reflexive triggers were not both asked for their aim');
    expect(aimOf(g, at, red), "the red copy's trigger: the pro-blue Scragnoth, never the pro-red Kor").toEqual([{ kind: 'card', id: scrag }]);
    expect(aimOf(g, at, blue), "the blue original's trigger: Kor, as its printed face allows").toEqual([{ kind: 'card', id: kor }]);
    expect(g.state.cards[scrag]?.tapped, "the red copy's payload tapped Scragnoth").toBe(true);
    expect(g.state.cards[kor]?.tapped, "the blue original's tapped Kor").toBe(true);
    hashHolds(g);
  });

  test("a copy's new targets are asked in the copy's colours: Fork's red rides the question and the harness re-aims it at Scragnoth; Reverberate's copy carries none", () => {
    for (const copier of ['Reverberate', 'Fork'] as const) {
      const g = startedGame({ players: 2, decks: [['Into the Roil', copier], ['Kor Firewalker', 'Scragnoth']] });
      holdEverywhere(g);
      const roil = put(g, 'p1', 'Into the Roil', 'hand');
      const copying = put(g, 'p1', copier, 'hand');
      const kor = put(g, 'p2', 'Kor Firewalker');
      const scrag = put(g, 'p2', 'Scragnoth');
      main3(g);
      mana(g, 'U', 2);
      must(g.submit({ t: 'CastSpell', player: 'p1', card: roil, targets: [{ kind: 'card', id: kor }] }));
      const roilObj = top(g);
      mana(g, 'R', 2);
      must(g.submit({ t: 'CastSpell', player: 'p1', card: copying, targets: [{ kind: 'stack', id: roilObj }] }));
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
      const ask = g.state.priority.awaiting;
      if (ask?.kind !== 'chooseTargets' || ask.forKind !== 'copy') throw new Error(`${copier}: the copy asked for no new targets`);
      if (copier === 'Fork') expect(ask.sourceColors, "Fork's copy is asked for its new targets in its red").toEqual(['R']);
      else expect('sourceColors' in ask, "Reverberate's copy has no colours of its own: its question as before").toBe(false);
      const at = g.log.length;
      // The harness answers the copy's question - before the fix it aimed Fork's red copy at Kor, and the host refused.
      settle(g);
      if (copier === 'Fork') {
        expect(aimOf(g, at, ask.stackId), 'the red copy re-aimed at the pro-blue Scragnoth, never the pro-red Kor').toEqual([{ kind: 'card', id: scrag }]);
        expect(g.state.cards[scrag]?.zone.kind, 'the red copy returned Scragnoth').toBe('hand');
        expect(g.state.cards[kor]?.zone.kind, 'the blue original returned Kor').toBe('hand');
      } else {
        expect(aimOf(g, at, ask.stackId), "the blue copy aimed at Kor, as the copied card's printed face allows").toEqual([{ kind: 'card', id: kor }]);
      }
      hashHolds(g);
    }
  });
});
