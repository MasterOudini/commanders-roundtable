// `Feeding Frenzy` — "Target creature gets -X/-X until end of turn, where
// X is the number of Zombies on the battlefield." The Zombie census is
// board-wide and DERIVED. D213.

import { FEEDING_FRENZY } from '../../../data/fixtures/engineCards';
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
  FEEDING_FRENZY,
  'Target creature gets -X/-X until end of turn, where X is the number of Zombies on the battlefield.',
);

export const FEEDING_FRENZY_SCRIPT: CardScript = {
  oracleId: FEEDING_FRENZY.oracleId,
  name: FEEDING_FRENZY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Zombie')) x++;
      }
      if (x <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -x, toughness: -x }];
    },
  },
};
