// `Arms of Hadar` — "Creatures target player controls get -2/-2 until end of
// turn." Alpha Brawl's iteration one sign over: the player is the target,
// every DERIVED creature they control gets its own entry, and the SBA does
// the killing (D165's rule). D198.

import { ARMS_OF_HADAR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ARMS_OF_HADAR, 'Creatures target player controls get -2/-2 until end of turn.');

export const ARMS_OF_HADAR_SCRIPT: CardScript = {
  oracleId: ARMS_OF_HADAR.oracleId,
  name: ARMS_OF_HADAR.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -2, toughness: -2 });
      }
      return events;
    },
  },
};
