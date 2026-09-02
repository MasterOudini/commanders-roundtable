// `Dauntless Onslaught` — up to two target creatures each get +2/+2 until
// cleanup. The first up-to-N card landed: the parser reads "up to two" as
// 0..2, the validator accepts any count in that range, and the resolve pumps
// whichever targets were named and are still on the battlefield.

import { DAUNTLESS_ONSLAUGHT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DAUNTLESS_ONSLAUGHT, 'Up to two target creatures each get +2/+2 until end of turn.');

export const DAUNTLESS_ONSLAUGHT_SCRIPT: CardScript = {
  oracleId: DAUNTLESS_ONSLAUGHT.oracleId,
  name: DAUNTLESS_ONSLAUGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: [] });
      }
      return events;
    },
  },
};
