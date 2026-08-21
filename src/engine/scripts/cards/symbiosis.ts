// `Symbiosis` — the counted pair, each pumped (Swelter's min2/max2 spec at
// +2/+2 instead of damage). D256.

import { SYMBIOSIS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SYMBIOSIS, 'Two target creatures each get +2/+2 until end of turn.');

export const SYMBIOSIS_SCRIPT: CardScript = {
  oracleId: SYMBIOSIS.oracleId,
  name: SYMBIOSIS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card') continue;
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 });
      }
      return events;
    },
  },
};
