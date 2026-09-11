// D392 - THE REFERENT SUBJECT: a later sentence about the previous clause's target ("Untap it.",
// "It gains haste until end of turn.", "That creature gains reach until end of turn.") is read by
// the rule its explicit form is read by and aimed where the previous clause aimed, consuming no
// target of its own. D373 named the gap ("NEVER `it`" as a self subject - on a spell it is the
// previous sentence's target); this is the seam that reads it for what it is.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { parseTargetClauses } from '../data/targetParse';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, deps, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

function derived(g: Game, id: InstanceId) {
  const d = deps(createRegistry([]));
  return derive(g.state, d.oracle, d.scripts, id);
}

describe('the referent vocabulary (D392)', () => {
  test('a referent after a targeted sentence is read by the explicit rule and aimed at that target', () => {
    const text = 'Target creature gets +1/+2 and gains reach until end of turn. Untap it.';
    const p = parseEffects(text, 'Vines of the Recluse', true);
    expect(p.mode).toBe('auto');
    expect(p.effects.map((e) => [e.kind, e.targetIndex, e.referent ?? false])).toEqual([
      ['pump', 0, false],
      ['untap', 0, true],
    ]);
    // The printed text still names ONE target: the referent consumed none.
    expect(parseTargetClauses(text)).toHaveLength(1);
    // The other order, and the "that creature" spelling.
    const q = parseEffects('Untap target creature. It gets +2/+2 and gains reach until end of turn.', 'Aim High', true);
    expect(q.mode).toBe('auto');
    expect(q.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['untap', 0], ['pump', 0]]);
    const r = parseEffects('Put a +1/+1 counter on target creature. That creature gains reach until end of turn.', 'Arbor Armament', true);
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => e.targetIndex)).toEqual([0, 0]);
    expect(r.effects[1]?.referent).toBe(true);
  });

  test('after a self sentence the referent is the self; with nothing before it the sentence stays unread', () => {
    const s = parseEffects('This creature gets +1/+0 until end of turn. It gains haste until end of turn.', '~', true);
    expect(s.mode).toBe('auto');
    expect(s.effects.map((e) => e.targetIndex)).toEqual([-1, -1]);
    expect(parseEffects('Untap it.', 'Test Card', true).mode).not.toBe('auto');
    expect(parseEffects('Draw a card. It gains haste until end of turn.', 'Test Card', true).mode).not.toBe('auto');
  });

  test('the referent points at the LAST target, and a player referent stays out of scope', () => {
    const t = parseEffects('Tap target creature. Destroy target artifact. Untap it.', 'Test Card', true);
    expect(t.mode).toBe('auto');
    expect(t.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['tap', 0], ['destroy', 1], ['untap', 1]]);
    expect(parseTargetClauses('Tap target creature. Destroy target artifact. Untap it.')).toHaveLength(2);
    // "Its controller ..." has rules of its own (D391's line 910 shape): it is read by THEM, never rewritten.
    const c = parseEffects('Target creature gets +1/+1 until end of turn. Its controller draws a card.', 'Test Card', true);
    expect(c.mode).toBe('auto');
    expect(c.effects.every((e) => e.referent === undefined)).toBe(true);
    expect(parseEffects('Target creature gets +1/+1 until end of turn. Its controller shuffles their library.', 'Test Card', true).mode).not.toBe('auto');
  });
});

describe('the referent in play (D392)', () => {
  test('Vines of the Recluse pumps, grants reach and untaps the same creature, and the game replays', () => {
    const g = startedGame({ players: 2, decks: [['Vines of the Recluse', 'Grizzly Bears'], ['Grizzly Bears']] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    expect(g.state.cards[bears]?.tapped).toBe(true);
    const vines = put(g, 'p1', 'Vines of the Recluse', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: vines, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const d = derived(g, bears);
    expect([d.power, d.toughness], 'the pump landed on the target').toEqual([3, 4]);
    expect(d.keywords.has('reach'), 'the keyword landed on the target').toBe(true);
    expect(g.state.cards[bears]?.tapped, 'the referent untap landed on the SAME creature').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Aim High untaps first and then pumps the same creature', () => {
    const g = startedGame({ players: 2, decks: [['Aim High', 'Grizzly Bears'], ['Grizzly Bears']] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    const aim = put(g, 'p1', 'Aim High', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aim, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const d = derived(g, bears);
    expect([d.power, d.toughness]).toEqual([4, 4]);
    expect(d.keywords.has('reach')).toBe(true);
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });
});
