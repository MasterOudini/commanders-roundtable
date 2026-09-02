// `Plunge into Winter` — tap up to one target creature; scry 1 (revealed
// first, D195), then draw a card — the draw rides the ask so it sees the
// library as reordered.

import { PLUNGE_INTO_WINTER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const TEXT = printed(PLUNGE_INTO_WINTER, 'Tap up to one target creature. Scry 1, then draw a card.');

export const PLUNGE_INTO_WINTER_SCRIPT: CardScript = {
  oracleId: PLUNGE_INTO_WINTER.oracleId,
  name: PLUNGE_INTO_WINTER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const cards: string[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) continue;
        cards.push(target.id);
      }
      if (cards.length > 0) events.push({ t: 'PermanentsTapped', cards });
      const library = ctx.state.zones.library[obj.controller] ?? [];
      if (library.length === 0) return events;
      if (library.length === 1) {
        // One card cannot be reordered: the scry is a look, then the draw.
        events.push(...drawEvents(ctx.state, obj.controller, 1));
        return events;
      }
      events.push({ t: 'CardsRevealed', cards: library.slice(library.length - 1), to: [obj.controller] });
      events.push({
        t: 'AwaitingSet',
        awaiting: { kind: 'scryChoice', player: obj.controller, count: 1, toGraveyard: false, thenDraw: 1, label: obj.label },
      });
      return events;
    },
  },
};
