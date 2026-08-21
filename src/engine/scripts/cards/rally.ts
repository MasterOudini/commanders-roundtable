// `Rally` — "Blocking creatures get +1/+1 until end of turn." Piety's
// sweep, one point each way. D237.

import { RALLY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RALLY, 'Blocking creatures get +1/+1 until end of turn.');

export const RALLY_SCRIPT: CardScript = {
  oracleId: RALLY.oracleId,
  name: RALLY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const b of ctx.state.combat?.blockers ?? []) {
        if (!ctx.state.cards[b.card]) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: b.card, power: 1, toughness: 1 });
      }
      return events;
    },
  },
};
