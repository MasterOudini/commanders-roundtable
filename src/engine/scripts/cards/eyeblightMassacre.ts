// `Eyeblight Massacre` — "Non-Elf creatures get -2/-2 until end of turn."
// The negated-subtype sweep (Breath Weapon's shape as a debuff). D212.

import { EYEBLIGHT_MASSACRE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(EYEBLIGHT_MASSACRE, 'Non-Elf creatures get -2/-2 until end of turn.');

export const EYEBLIGHT_MASSACRE_SCRIPT: CardScript = {
  oracleId: EYEBLIGHT_MASSACRE.oracleId,
  name: EYEBLIGHT_MASSACRE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.typeLine.subtypes.includes('Elf')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -2, toughness: -2 });
      }
      return events;
    },
  },
};
