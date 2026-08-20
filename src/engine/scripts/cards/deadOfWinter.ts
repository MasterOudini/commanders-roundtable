// `Dead of Winter` — "All nonsnow creatures get -X/-X until end of turn,
// where X is the number of snow permanents you control." Cower in Fear's
// board debuff with a computed X: the Snow SUPERTYPE read off the DERIVED
// type line on both sides — the count and the exemption. D206.

import { DEAD_OF_WINTER } from '../../../data/fixtures/engineCards';
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
  DEAD_OF_WINTER,
  'All nonsnow creatures get -X/-X until end of turn, where X is the number of snow permanents you control.',
);

export const DEAD_OF_WINTER_SCRIPT: CardScript = {
  oracleId: DEAD_OF_WINTER.oracleId,
  name: DEAD_OF_WINTER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.supertypes.includes('Snow')) x += 1;
      }
      if (x <= 0) return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.typeLine.supertypes.includes('Snow')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -x, toughness: -x });
      }
      return events;
    },
  },
};
