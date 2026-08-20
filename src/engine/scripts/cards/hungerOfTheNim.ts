// `Hunger of the Nim` — +1/+0 per artifact I control. D218.

import { HUNGER_OF_THE_NIM } from '../../../data/fixtures/engineCards';
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
  HUNGER_OF_THE_NIM,
  'Target creature gets +1/+0 until end of turn for each artifact you control.',
);

export const HUNGER_OF_THE_NIM_SCRIPT: CardScript = {
  oracleId: HUNGER_OF_THE_NIM.oracleId,
  name: HUNGER_OF_THE_NIM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Artifact')) n++;
      }
      if (n === 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: n, toughness: 0 }];
    },
  },
};
