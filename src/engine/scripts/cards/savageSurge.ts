// `Savage Surge` — "Target creature gets +2/+2 until end of turn. Untap
// that creature." The pump-and-untap in one resolve. D243.

import { SAVAGE_SURGE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  SAVAGE_SURGE,
  'Target creature gets +2/+2 until end of turn. Untap that creature.',
);

export const SAVAGE_SURGE_SCRIPT: CardScript = {
  oracleId: SAVAGE_SURGE.oracleId,
  name: SAVAGE_SURGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 },
      ];
      if (card.tapped) events.push({ t: 'PermanentsUntapped', cards: [target.id] });
      return events;
    },
  },
};
