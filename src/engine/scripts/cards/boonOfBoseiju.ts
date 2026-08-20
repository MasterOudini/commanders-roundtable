// `Boon of Boseiju` — "Target creature gets +X/+X until end of turn, where
// X is the greatest mana value among permanents you control. Untap it."
// The computed pump (whole-card mana value off the oracle, tokens count 0)
// plus Filigree's untap — an already-upright target just skips the event.
// D201.

import { BOON_OF_BOSEIJU } from '../../../data/fixtures/engineCards';
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
  BOON_OF_BOSEIJU,
  'Target creature gets +X/+X until end of turn, where X is the greatest mana value among permanents you control. Untap it.',
);

export const BOON_OF_BOSEIJU_SCRIPT: CardScript = {
  oracleId: BOON_OF_BOSEIJU.oracleId,
  name: BOON_OF_BOSEIJU.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const c = ctx.state.cards[id];
        if (!c || c.controller !== obj.controller) continue;
        const mv = ctx.oracle.byPrinting(c.printingId)?.manaValue ?? 0;
        if (mv > x) x = mv;
      }
      const events: EventBody[] = [];
      if (x > 0) {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: x, toughness: x });
      }
      if (card.tapped) events.push({ t: 'PermanentsUntapped', cards: [target.id] });
      return events;
    },
  },
};
