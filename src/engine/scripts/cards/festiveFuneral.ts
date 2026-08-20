// `Festive Funeral` — "Target creature gets -X/-X until end of turn, where
// X is the number of cards in your graveyard." D213.

import { FESTIVE_FUNERAL } from '../../../data/fixtures/engineCards';
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
  FESTIVE_FUNERAL,
  'Target creature gets -X/-X until end of turn, where X is the number of cards in your graveyard.',
);

export const FESTIVE_FUNERAL_SCRIPT: CardScript = {
  oracleId: FESTIVE_FUNERAL.oracleId,
  name: FESTIVE_FUNERAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const x = (ctx.state.zones.graveyard[obj.controller] ?? []).length;
      if (x <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -x, toughness: -x }];
    },
  },
};
