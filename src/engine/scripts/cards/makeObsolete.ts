// `Make Obsolete` — opponents' creatures get -1/-1 for the turn. D223.

import { MAKE_OBSOLETE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MAKE_OBSOLETE, 'Creatures your opponents control get -1/-1 until end of turn.');

export const MAKE_OBSOLETE_SCRIPT: CardScript = {
  oracleId: MAKE_OBSOLETE.oracleId,
  name: MAKE_OBSOLETE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -1, toughness: -1 });
      }
      return events;
    },
  },
};
