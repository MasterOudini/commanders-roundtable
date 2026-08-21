// `Strength of Cedars` — +X/+X where X is my land count. D254.

import { STRENGTH_OF_CEDARS } from '../../../data/fixtures/engineCards';
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
  STRENGTH_OF_CEDARS,
  'Target creature gets +X/+X until end of turn, where X is the number of lands you control.',
);

export const STRENGTH_OF_CEDARS_SCRIPT: CardScript = {
  oracleId: STRENGTH_OF_CEDARS.oracleId,
  name: STRENGTH_OF_CEDARS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Land')) x += 1;
      }
      if (x <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: x, toughness: x }];
    },
  },
};
