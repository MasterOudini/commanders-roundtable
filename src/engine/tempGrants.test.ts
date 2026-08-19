// D194 — temporary keyword grants: the carrier D153 measured missing under
// 958 sole-need cards. `untilEndOfTurn` held power and toughness and nothing
// else, so no spell could grant flying for a turn. Now the entry carries
// optional keywords, `derive` reads them at layer 6 after the statics
// (additions commute — the ordering argument is in derive.ts), and the same
// `UntilEndOfTurnEnded` cleanup ends them.
//
// The vocabulary halves are here too because the parse IS the unlock: the
// closed GRANTABLE map decides what may ever be granted, so an unenforced
// keyword makes the whole sentence unread (D90 — a grant that "succeeds"
// without enforcement is a card half-working while looking whole).

import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { ORACLE, advanceUntil, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('the grant vocabulary (D194)', () => {
  test('a pure grant is understood completely — Jump', () => {
    const p = parseEffects('Target creature gains flying until end of turn.', 'Jump', true);
    expect(p.mode).toBe('auto');
    expect(p.effects[0]?.kind).toBe('pump');
    expect(p.effects[0]?.keywords).toEqual(['flying']);
  });

  test('the pump-with-rider is one clause — Rush of Adrenaline', () => {
    const p = parseEffects(
      'Target creature gets +2/+1 and gains trample until end of turn.',
      'Rush of Adrenaline',
      true,
    );
    expect(p.mode).toBe('auto');
    expect(p.effects[0]?.power).toBe(2);
    expect(p.effects[0]?.toughness).toBe(1);
    expect(p.effects[0]?.keywords).toEqual(['trample']);
  });

  test('two keywords, and the printed name maps to the enforced member', () => {
    const p = parseEffects(
      'Target creature gains flying and first strike until end of turn.',
      'Test Card',
      true,
    );
    expect(p.mode).toBe('auto');
    expect(p.effects[0]?.keywords).toEqual(['flying', 'firstStrike']);
  });

  test('a keyword outside the closed map leaves the sentence unread', () => {
    // "banding" is real and unenforced; granting it "successfully" would be
    // a card half-working while looking whole. The map is the safety
    // property, exactly as `counterKindOf` is for counters.
    expect(
      parseEffects('Target creature gains banding until end of turn.', 'Test Card', true).mode,
    ).not.toBe('auto');
    // toxic carries a NUMBER, which this shape does not read.
    expect(
      parseEffects('Target creature gains toxic 2 until end of turn.', 'Test Card', true).mode,
    ).not.toBe('auto');
  });
});

describe('the grant in play (D194)', () => {
  function granted(spell: string, extraMana: 'U' | 'R'): { g: Game; bears: InstanceId } {
    const g = startedGame({ players: 2, decks: [[spell, 'Grizzly Bears'], ['Grizzly Bears']] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const card = put(g, 'p1', spell, 'hand');
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: extraMana, amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    return { g, bears };
  }

  test('Jump grants DERIVED flying, and cleanup takes it back', () => {
    const { g, bears } = granted('Jump', 'U');
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(true);
    // The next turn's cleanup has passed — the grant is gone, the card lives.
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(false);
  });

  test('Rush of Adrenaline: the P/T halves and the keyword ride ONE entry', () => {
    const { g, bears } = granted('Rush of Adrenaline', 'R');
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(3);
    expect(d.keywords.has('trample')).toBe(true);
  });

  test('replays to the same hash with a grant on the log', () => {
    const { g } = granted('Jump', 'U');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
