// `Donatello's Science Lesson` — two clauses of "up to two": creatures to
// tap and players to draw; the targets are partitioned by kind, never by
// position (D288).

import { DONATELLO_S_SCIENCE_LESSON } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DONATELLO_S_SCIENCE_LESSON, 'Tap up to two target creatures. Up to two target players each draw a card.');

export const DONATELLOS_SCIENCE_LESSON_SCRIPT: CardScript = {
  oracleId: DONATELLO_S_SCIENCE_LESSON.oracleId,
  name: DONATELLO_S_SCIENCE_LESSON.name,
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
      for (const target of obj.targets) {
        if (target.kind !== 'player') continue;
        const them = ctx.state.players[target.id];
        if (!them || them.hasLost) continue;
        events.push(...drawEvents(ctx.state, target.id, 1));
      }
      return events;
    },
  },
};
