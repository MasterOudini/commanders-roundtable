// `Nocturnal Raid` — "Black creatures get +2/+0 until end of turn." The
// color-filtered board pump, asked of the DERIVED colors. D229.

import { NOCTURNAL_RAID } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(NOCTURNAL_RAID, 'Black creatures get +2/+0 until end of turn.');

export const NOCTURNAL_RAID_SCRIPT: CardScript = {
  oracleId: NOCTURNAL_RAID.oracleId,
  name: NOCTURNAL_RAID.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.colors.includes('B')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: 2, toughness: 0 });
      }
      return events;
    },
  },
};
