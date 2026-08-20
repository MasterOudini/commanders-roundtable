// `Brightstone Ritual` — "Add {R} for each Goblin on the battlefield."
// Battle Hymn's ritual counting EVERYONE's Goblins by derived subtype.
// D201.

import { BRIGHTSTONE_RITUAL } from '../../../data/fixtures/engineCards';
import { EMPTY_POOL } from '../../types/mana';
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

const TEXT = printed(BRIGHTSTONE_RITUAL, 'Add {R} for each Goblin on the battlefield.');

export const BRIGHTSTONE_RITUAL_SCRIPT: CardScript = {
  oracleId: BRIGHTSTONE_RITUAL.oracleId,
  name: BRIGHTSTONE_RITUAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (ctx.derive(id).typeLine.subtypes.includes('Goblin')) n++;
      }
      if (n === 0) return [];
      return [
        { t: 'ManaAdded', player: obj.controller, mana: { ...EMPTY_POOL, R: n }, source: self },
      ];
    },
  },
};
