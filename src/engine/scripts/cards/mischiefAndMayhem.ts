// `Mischief and Mayhem` — up to two target creatures each get +4/+4 until
// cleanup.

import { MISCHIEF_AND_MAYHEM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MISCHIEF_AND_MAYHEM, 'Up to two target creatures each get +4/+4 until end of turn.');

export const MISCHIEF_AND_MAYHEM_SCRIPT: CardScript = {
  oracleId: MISCHIEF_AND_MAYHEM.oracleId,
  name: MISCHIEF_AND_MAYHEM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 4, toughness: 4, keywords: [] });
      }
      return events;
    },
  },
};
