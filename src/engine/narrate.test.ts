// The log reads in the second person for the player reading it.
//
// ⚠️ THE THIRD PERSON MUST NOT MOVE. `NarrationLine.text` goes on disk in the
// NDJSON log, is covered by the state hash, and is what a spectator reads — so
// every case here pins the third-person string as well as the second-person one.
// A "fix" that improved the grammar for one reader by changing the canonical text
// would be a silent change to every log ever written.

import { describe, expect, test } from 'vitest';
import { n, narrated, ref, render, their, themself, they, vb, who, whose } from './narrate';
import { startedGame } from './testing/harness';
import type { GameState } from './types/state';

/** Two players, so `who()` has real names to read. */
function state(): GameState {
  return startedGame({ players: 2 }).state;
}

function both(parts: ReturnType<typeof n>): [string, string] {
  return [render(parts, null), render(parts, 'p1')];
}

describe('render', () => {
  test('the subject and its verb both switch person', () => {
    const s = state();
    expect(both(n`${who(s, 'p1')} ${vb('p1', 'draws', 'draw')} a card.`)).toEqual([
      'Ana draws a card.',
      'You draw a card.',
    ]);
  });

  test('a line about somebody else is untouched for me', () => {
    const s = state();
    const parts = n`${who(s, 'p2')} ${vb('p2', 'draws', 'draw')} a card.`;
    expect(render(parts, 'p1')).toBe('Ben draws a card.');
    expect(render(parts, 'p2')).toBe('You draw a card.');
  });

  test('`me = null` is the canonical third person — a spectator, the disk log', () => {
    const s = state();
    expect(render(n`${who(s, 'p1')} ${vb('p1', 'wins', 'win')}.`, null)).toBe('Ana wins.');
  });

  test('possessives, pronouns and reflexives each have their own form', () => {
    const s = state();
    // Mid-sentence, which is the only place any real template uses a possessive.
    expect(both(n`Ben shuffles ${whose(s, 'p1')} library.`)).toEqual([
      "Ben shuffles Ana's library.",
      'Ben shuffles your library.',
    ]);
    expect(both(n`of ${their('p1')} library`)).toEqual(['of their library', 'of your library']);
    expect(both(n`to ${themself('p1')}`)).toEqual(['to themselves', 'to yourself']);
    expect(both(n`— ${they('p1')} skip`)).toEqual(['— They skip', '— You skip']);
  });

  test('two players in one sentence, and the verb agrees with the SUBJECT', () => {
    // The real line from `handlers.ts`: coloured for the disconnected seat (D100)
    // while its grammar belongs to whoever clicked.
    const s = state();
    const parts = n`${who(s, 'p1')} passed for ${who(s, 'p2')}, who is disconnected.`;
    expect(render(parts, null)).toBe('Ana passed for Ben, who is disconnected.');
    expect(render(parts, 'p1')).toBe('You passed for Ben, who is disconnected.');
    expect(render(parts, 'p2')).toBe('Ana passed for you, who is disconnected.');
  });

  test('a player-free line reads the same to everyone', () => {
    const parts = n`Lightning Bolt resolves.`;
    expect(render(parts, null)).toBe('Lightning Bolt resolves.');
    expect(render(parts, 'p1')).toBe('Lightning Bolt resolves.');
  });

  describe('capitalisation is decided by position, not by the call site', () => {
    test('"you" is capitalised at the start of a line', () => {
      expect(render(n`${who(state(), 'p1')} won.`, 'p1')).toBe('You won.');
    });

    test('and after a sentence end, an em dash or a colon', () => {
      const p = ref('p1', 'they', 'you');
      expect(render(n`Done. ${p} go.`, 'p1')).toBe('Done. You go.');
      expect(render(n`Turn 1 — ${p}.`, 'p1')).toBe('Turn 1 — You.');
      expect(render(n`Waiting: ${p}.`, 'p1')).toBe('Waiting: You.');
    });

    test('and NOT mid-sentence', () => {
      expect(render(n`Ben sets ${who(state(), 'p1')} to 12 life.`, 'p1')).toBe(
        'Ben sets you to 12 life.',
      );
    });

    test('which is what capitalises "They" in the third person too', () => {
      // `they()` is stored lowercase; both persons need the capital here, and one
      // positional rule is what gives them it.
      expect(render(n`Turn 1 — Ana. ${they('p1')} skip.`, null)).toBe('Turn 1 — Ana. They skip.');
    });
  });
});

describe('n', () => {
  test('interpolated strings and numbers become literals', () => {
    // The real templates pluralise exactly like this, off a `number`.
    const count: number = 3;
    const parts = n`${count} card${count === 1 ? '' : 's'} of ${'Ana'}.`;
    expect(render(parts, 'p1')).toBe('3 cards of Ana.');
  });

  test('adjacent literals are merged, so one sentence has one shape', () => {
    // ⚠️ A normalisation, not an optimisation: parts live in `GameState` and are
    // covered by the state hash, so two ways of writing one sentence must produce
    // identical parts.
    expect(n`a${'b'}c`).toEqual([{ lit: 'abc' }]);
    expect(n`${who(state(), 'p1')} x`.length).toBe(2);
  });
});

describe('narrated', () => {
  test('derives `text` from the parts, in the third person', () => {
    const s = state();
    const body = narrated(n`${who(s, 'p1')} ${vb('p1', 'draws', 'draw')} a card.`, 'p1');
    expect(body).toMatchObject({ t: 'Narrated', text: 'Ana draws a card.', player: 'p1' });
  });

  test('still takes a plain string, for a line whose subject is a card', () => {
    const body = narrated('No blocks.', null);
    expect(body).toMatchObject({ t: 'Narrated', text: 'No blocks.', parts: [{ lit: 'No blocks.' }] });
  });

  test('an empty line carries no parts rather than an empty literal', () => {
    expect(narrated('', null)).toMatchObject({ text: '', parts: [] });
  });
});

/**
 * Every third-person verb form any template uses. A subject switched to "You"
 * with its verb left behind is exactly the reported bug ("You draws a card."), so
 * this is the pattern the whole change exists to make impossible.
 */
const THIRD_PERSON_VERBS = [
  'draws', 'plays', 'casts', 'keeps', 'puts', 'moves', 'goes', 'loses', 'wins',
  'concedes', 'mulligans', 'attacks', 'activates', 'returns', 'rolls', 'flips',
  'proposes', 'creates', 'adds', 'removes', 'sets', 'empties', 'taps', 'untaps',
  'turns', 'transforms', 'clears', 'attaches', 'unattaches', 'gives', 'reveals',
  'looks', 'shuffles', 'applies', 'makes', 'stops', 'skips',
];
const STRANDED = new RegExp(`\\b[Yy]ou (?:${THIRD_PERSON_VERBS.join('|')})\\b`);

describe('a real game', () => {
  test('no line about my seat strands a third-person verb after "You"', () => {
    const game = startedGame({ players: 4 });
    const mine = game.state.narration.filter((line) => line.player === 'p1');
    expect(mine.length).toBeGreaterThan(0);
    for (const line of mine) expect(render(line.parts, 'p1')).not.toMatch(STRANDED);
  });

  test('the third-person text is what a line renders to with no reader', () => {
    // `text` is derived, so this is the invariant that keeps the disk log, the
    // state hash and the spectator view agreeing with each other.
    for (const line of startedGame({ players: 4 }).state.narration) {
      expect(render(line.parts, null)).toBe(line.text);
    }
  });

  test('a line about somebody else is byte-identical whoever reads it', () => {
    for (const line of startedGame({ players: 4 }).state.narration) {
      if (line.player === 'p3') continue;
      expect(render(line.parts, 'p3')).toBe(line.text);
      expect(render(line.parts, 'p3')).not.toMatch(/\b[Yy]our?(?:self)?\b/);
    }
  });

  test('`project()` is where the log learns who is reading it', () => {
    // The renderer never does this itself — `src/ui/` reads `view.log` and knows
    // nothing about person. Each client projects with its own `me`, which is what
    // makes this correct in multiplayer and across the solo hotseat's seat moves.
    const game = startedGame({ players: 4 });
    const rowFor = (viewer: string): string => {
      const row = game.view(viewer).log.find((e) => e.text.includes('keep'));
      if (!row) throw new Error('no keep line in the log');
      return row.text;
    };
    expect(rowFor('p1')).toBe('You keep 7.');
    expect(rowFor('p2')).toBe('Ana keeps 7.');
  });
});
