// `Valorous Charge` — the COLOUR-filtered pump sweep, and it says "white
// creatures" with no controller: an opponent's white creature gets it too,
// which is the case worth pinning. Colour is read DERIVED. D265.

import { VALOROUS_CHARGE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(VALOROUS_CHARGE, 'White creatures get +2/+0 until end of turn.');

export const VALOROUS_CHARGE_SCRIPT: CardScript = {
  oracleId: VALOROUS_CHARGE.oracleId,
  name: VALOROUS_CHARGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.colors.includes('W')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: 2, toughness: 0 });
      }
      return events;
    },
  },
};
