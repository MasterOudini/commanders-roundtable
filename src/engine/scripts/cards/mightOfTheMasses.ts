// `Might of the Masses` — "Target creature gets +1/+1 until end of turn for
// each creature you control." Massive Raid's census on a pump. D224.

import { MIGHT_OF_THE_MASSES } from '../../../data/fixtures/engineCards';
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
  MIGHT_OF_THE_MASSES,
  'Target creature gets +1/+1 until end of turn for each creature you control.',
);

export const MIGHT_OF_THE_MASSES_SCRIPT: CardScript = {
  oracleId: MIGHT_OF_THE_MASSES.oracleId,
  name: MIGHT_OF_THE_MASSES.name,
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
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        n++;
      }
      if (n === 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: n, toughness: n }];
    },
  },
};
