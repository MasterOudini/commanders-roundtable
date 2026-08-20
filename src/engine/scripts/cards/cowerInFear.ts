// `Cower in Fear` — "Creatures your opponents control get -1/-1 until end
// of turn." D205.

import { COWER_IN_FEAR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(COWER_IN_FEAR, 'Creatures your opponents control get -1/-1 until end of turn.');

export const COWER_IN_FEAR_SCRIPT: CardScript = {
  oracleId: COWER_IN_FEAR.oracleId,
  name: COWER_IN_FEAR.name,
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
