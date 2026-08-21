// `Primal Bellow` — "Target creature gets +1/+1 until end of turn for
// each Forest you control." The Forest-census pump. D235.

import { PRIMAL_BELLOW } from '../../../data/fixtures/engineCards';
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
  PRIMAL_BELLOW,
  'Target creature gets +1/+1 until end of turn for each Forest you control.',
);

export const PRIMAL_BELLOW_SCRIPT: CardScript = {
  oracleId: PRIMAL_BELLOW.oracleId,
  name: PRIMAL_BELLOW.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let forests = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Forest')) forests++;
      }
      if (forests === 0) return [];
      return [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: forests, toughness: forests },
      ];
    },
  },
};
