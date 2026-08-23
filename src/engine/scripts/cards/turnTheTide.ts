// `Turn the Tide` — the one-side debuff sweep (Neutralize the Guards D228):
// every creature MY OPPONENTS control, and none of mine. D263.

import { TURN_THE_TIDE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  TURN_THE_TIDE,
  'Creatures your opponents control get -2/-0 until end of turn.',
);

export const TURN_THE_TIDE_SCRIPT: CardScript = {
  oracleId: TURN_THE_TIDE.oracleId,
  name: TURN_THE_TIDE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller === obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -2, toughness: 0 });
      }
      return events;
    },
  },
};
