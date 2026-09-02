// `Nahiri's Stoneblades` — up to two target creatures each get +2/+0 until
// cleanup.

import { NAHIRI_S_STONEBLADES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(NAHIRI_S_STONEBLADES, 'Up to two target creatures each get +2/+0 until end of turn.');

export const NAHIRIS_STONEBLADES_SCRIPT: CardScript = {
  oracleId: NAHIRI_S_STONEBLADES.oracleId,
  name: NAHIRI_S_STONEBLADES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0, keywords: [] });
      }
      return events;
    },
  },
};
