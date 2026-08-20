// `Nausea` — "All creatures get -1/-1 until end of turn." The plain board
// debuff; the SBA does the killing. D227.

import { NAUSEA } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(NAUSEA, 'All creatures get -1/-1 until end of turn.');

export const NAUSEA_SCRIPT: CardScript = {
  oracleId: NAUSEA.oracleId,
  name: NAUSEA.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -1, toughness: -1 });
      }
      return events;
    },
  },
};
