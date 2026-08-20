// `Muscle Burst` — "Target creature gets +X/+X until end of turn, where X
// is 3 plus the number of cards named Muscle Burst in all graveyards."
// Mind Burst's name census on a pump. D227.

import { MUSCLE_BURST } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  MUSCLE_BURST,
  'Target creature gets +X/+X until end of turn, where X is 3 plus the number of cards named Muscle Burst in all graveyards.',
);

export const MUSCLE_BURST_SCRIPT: CardScript = {
  oracleId: MUSCLE_BURST.oracleId,
  name: MUSCLE_BURST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let named = 0;
      for (const seat of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[seat] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card && ctx.oracle.byPrinting(card.printingId);
          if (oc && faceOf(oc, card.faceIndex ?? 0).name === 'Muscle Burst') named++;
        }
      }
      const x = 3 + named;
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: x, toughness: x }];
    },
  },
};
