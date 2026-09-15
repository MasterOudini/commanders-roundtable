// D441 - THE REVEAL LANDS: `As this land enters, you may reveal a Plains or Island card from your hand. If you don't,
// it enters tapped.` is the second ASKED enters-tapped condition (D136's life was the first): the prompt carries the
// noun and never the candidates, the funnel asks only a hand that holds such a card, the answer names the card and
// the host checks it, the reveal is an event every seat sees.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { must, put, startedGame, ORACLE } from './testing/harness';
import { unaccountedLines } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import type { Game } from './game';

const LANDS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
function game(p1: readonly string[]): Game {
  return startedGame({ players: 2, decks: [[...p1, ...LANDS], LANDS] });
}
function asked(g: Game) {
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'entersChoice') throw new Error(`expected an entersChoice question, got ${a?.kind ?? 'none'}`);
  return a;
}

describe('the reveal lands (D441)', () => {
  test('the clause is an ASKED condition, read as the noun it prints', () => {
    expect(ORACLE.byName('Port Town')?.faces[0]?.entersTapped).toEqual({
      unless: { kind: 'reveal', any: [{ supertypes: [], types: [], subtypes: ['Plains'], colors: [] }, { supertypes: [], types: [], subtypes: ['Island'], colors: [] }], text: 'Plains or Island' },
    });
    expect(ORACLE.byName('Ancient Amphitheater')?.faces[0]?.entersTapped).toEqual({
      unless: { kind: 'reveal', any: [{ supertypes: [], types: [], subtypes: ['Giant'], colors: [] }], text: 'Giant' },
    });
    const card = ENGINE_CARDS.find((c) => c.name === 'Port Town');
    if (!card) throw new Error('no fixture');
    expect(unaccountedLines(card, 0)).toEqual([]);
  });

  test('a hand holding a Plains is asked; revealing it shows the card to every seat and the land enters untapped', () => {
    const g = game(['Port Town', 'Plains']);
    const plains = put(g, 'p1', 'Plains', 'hand');
    const town = put(g, 'p1', 'Port Town');
    const a = asked(g);
    expect(a.player).toBe('p1');
    expect(a.source).toBe(town);
    expect(a.reveal?.text).toBe('Plains or Island');
    expect(a.life).toBe(0);
    // A Forest is not a Plains or Island; naming nothing is not a reveal.
    const forest = g.state.zones.hand['p1']?.find((id) => ORACLE.byPrinting(g.state.cards[id]?.printingId ?? '')?.name === 'Forest');
    if (forest !== undefined) expect(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: town, pay: true, reveal: forest }).ok).toBe(false);
    expect(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: town, pay: true }).ok).toBe(false);
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: town, pay: true, reveal: plains }));
    expect(g.state.cards[town]?.tapped).toBe(false);
    expect(g.state.cards[plains]?.zone.kind).toBe('hand');
    expect(g.log.some((e) => e.body.t === 'CardsRevealed' && e.body.cards.includes(plains) && e.body.to.length === 2)).toBe(true);
    expect(g.state.priority.awaiting).toBeNull();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declining taps it; a hand with nothing to show is not asked and the land enters tapped', () => {
    const g = game(['Port Town', 'Island']);
    put(g, 'p1', 'Island', 'hand');
    const town = put(g, 'p1', 'Port Town');
    asked(g);
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: town, pay: false }));
    expect(g.state.cards[town]?.tapped).toBe(true);

    const bare = game(['Ancient Amphitheater']);
    const amph = put(bare, 'p1', 'Ancient Amphitheater');
    expect(bare.state.priority.awaiting).toBeNull();
    expect(bare.state.cards[amph]?.tapped).toBe(true);
    expect(bare.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'entersChoice')).toBe(false);
  });
});
