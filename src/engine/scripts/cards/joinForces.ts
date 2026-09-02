// `Join Forces` — up to two target creatures untap and each get +2/+2 until
// cleanup.

import { JOIN_FORCES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(JOIN_FORCES, 'Untap up to two target creatures. They each get +2/+2 until end of turn.');

export const JOIN_FORCES_SCRIPT: CardScript = {
  oracleId: JOIN_FORCES.oracleId,
  name: JOIN_FORCES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const untap: string[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (card.tapped) untap.push(target.id);
      }
      if (untap.length > 0) events.push({ t: 'PermanentsUntapped', cards: untap });
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: [] });
      }
      return events;
    },
  },
};
