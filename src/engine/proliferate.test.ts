// D391 - proliferate (CR 701.27a): the resolution stops and asks its controller to choose any
// number of permanents and players that have a counter, and the answer puts one more of each kind
// present. The prompt ships NO ids (counters and poison are public - the client lists them itself),
// the ask is raised only when something carries a counter once the sentences before it have landed,
// and the host checks every pick against the board as it stands.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { proliferateCandidates } from './proliferate';
import { advanceUntil, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

describe('the proliferate vocabulary (D391)', () => {
  test('the bare sentence and the comma form are read, and the ask is last', () => {
    expect(parseEffects('Proliferate.', 'Test Card', true).mode).toBe('auto');
    const p = parseEffects('Destroy target creature, then proliferate.', 'Test Card', true);
    expect(p.mode).toBe('auto');
    expect(p.effects.map((e) => e.kind)).toEqual(['destroy', 'proliferate']);
    expect(parseEffects('Draw two cards, then proliferate.', "Tezzeret's Gambit", true).mode).toBe('auto');
    expect(parseEffects('Put a -1/-1 counter on target creature, then proliferate.', 'Grim Affliction', true).mode).toBe('auto');
  });

  test('an effect after the ask, a conditional and a payment around it stay refused', () => {
    // "Proliferate. Draw a card." would ask and silently drop the draw - half-execution while
    // every sentence reads as understood. The guard lands it assisted instead (D195).
    expect(parseEffects('Proliferate.\nDraw a card.', 'Contentious Plan', true).mode).not.toBe('auto');
    expect(parseEffects("Counter target spell. If that spell's mana value was 3 or less, proliferate.", 'Reject Imperfection', true).mode).not.toBe('auto');
    expect(parseEffects('You may pay {2}. If you do, proliferate.', 'Test Card', true).mode).not.toBe('auto');
  });
});

describe('the proliferate in play (D391)', () => {
  function armed(): { g: Game; affliction: InstanceId; bears: InstanceId; dreadmaw: InstanceId } {
    const g = startedGame({
      players: 2,
      decks: [['Grim Affliction', "Vivisurgeon's Insight", 'Grizzly Bears'], ['Colossal Dreadmaw', 'Grizzly Bears']],
    });
    const affliction = put(g, 'p1', 'Grim Affliction', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
    return { g, affliction, bears, dreadmaw };
  }

  function castAffliction(g: Game, card: InstanceId, at: InstanceId): void {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: at }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'proliferateChoice', 20_000);
  }

  test('the ask comes to the caster AFTER the counter landed, ships no ids, and offers what carries one', () => {
    const { g, affliction, bears, dreadmaw } = armed();
    expect(proliferateCandidates(g.state).any).toBe(false);
    castAffliction(g, affliction, dreadmaw);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('proliferateChoice');
    expect(awaiting?.kind === 'proliferateChoice' && awaiting.player).toBe('p1');
    expect(Object.keys(awaiting ?? {}).sort()).toEqual(['kind', 'label', 'player']);
    // The first clause has already resolved: the -1/-1 counter is on the board while the prompt is up.
    expect(g.state.cards[dreadmaw]?.counters['-1/-1']).toBe(1);
    const cands = proliferateCandidates(g.state);
    expect(cands.permanents).toEqual([dreadmaw]);
    expect(cands.permanents).not.toContain(bears);
    expect(cands.players).toEqual([]);
  });

  test('the answer puts one more of EACH kind present, in one batch, and the game goes on', () => {
    const { g, affliction, dreadmaw } = armed();
    // A charge counter, not a +1/+1: a +1/+1 beside the -1/-1 the spell puts would ANNIHILATE
    // first (CR 704.5q, SBA 8) and the board would read no counters at all - the engine corrected
    // the first draft of this test (D227).
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: dreadmaw, kind: 'charge', delta: 1 }));
    castAffliction(g, affliction, dreadmaw);
    expect(g.state.cards[dreadmaw]?.counters).toEqual({ charge: 1, '-1/-1': 1 });
    const before = g.log.length;
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [dreadmaw], players: [] }));
    expect(g.state.cards[dreadmaw]?.counters).toEqual({ charge: 2, '-1/-1': 2 });
    const since = g.log.slice(before).map((e) => e.body);
    expect(since.filter((b) => b.t === 'CountersChanged')).toHaveLength(1);
    expect(since.some((b) => b.t === 'Proliferated' && b.permanents.length === 1)).toBe(true);
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a pick with no counter, another player, a duplicate and a player with no poison are refused; nothing is a legal answer', () => {
    const { g, affliction, bears, dreadmaw } = armed();
    castAffliction(g, affliction, dreadmaw);
    const noCounter = g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [bears], players: [] });
    expect(noCounter.ok).toBe(false);
    expect(!noCounter.ok && noCounter.reason).toBe('illegalTarget');
    const wrongPlayer = g.submit({ t: 'AnswerProliferate', player: 'p2', permanents: [dreadmaw], players: [] });
    expect(wrongPlayer.ok).toBe(false);
    expect(!wrongPlayer.ok && wrongPlayer.reason).toBe('notAwaitingThat');
    const twice = g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [dreadmaw, dreadmaw], players: [] });
    expect(twice.ok).toBe(false);
    expect(!twice.ok && twice.reason).toBe('noSuchCard');
    const noPoison = g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [], players: ['p2'] });
    expect(noPoison.ok).toBe(false);
    expect(!noPoison.ok && noPoison.reason).toBe('illegalTarget');
    // Every refusal left the prompt standing, and nothing moved.
    expect(g.state.priority.awaiting?.kind).toBe('proliferateChoice');
    expect(g.state.cards[dreadmaw]?.counters['-1/-1']).toBe(1);
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [], players: [] }));
    expect(g.state.cards[dreadmaw]?.counters['-1/-1']).toBe(1);
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('a player with poison is a candidate and takes one more', () => {
    const { g, affliction, dreadmaw } = armed();
    must(g.submit({ t: 'ManualSetPoison', player: 'p1', target: 'p2', delta: 2 }));
    castAffliction(g, affliction, dreadmaw);
    expect(proliferateCandidates(g.state).players).toEqual(['p2']);
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [dreadmaw], players: ['p2'] }));
    expect(g.state.players['p2']?.poison).toBe(3);
    expect(g.state.cards[dreadmaw]?.counters['-1/-1']).toBe(2);
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('nothing carrying a counter is no prompt: the spell resolves and the rest of it runs', () => {
    const g = startedGame({
      players: 2,
      decks: [["Vivisurgeon's Insight", 'Grizzly Bears'], ['Grizzly Bears']],
    });
    const insight = put(g, 'p1', "Vivisurgeon's Insight", 'hand');
    put(g, 'p1', 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
    const hand0 = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 6 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: insight, targets: [] }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'proliferateChoice')).toBe(false);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(hand0 - 1 + 3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
