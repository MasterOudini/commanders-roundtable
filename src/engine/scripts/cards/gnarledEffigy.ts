// `Gnarled Effigy` — "{4}, {T}: Put a -1/-1 counter on target creature."
// Fume Spitter's payload behind a tap-and-mana cost. M6.4u, D177.

import { GNARLED_EFFIGY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GNARLED_EFFIGY, '{4}, {T}: Put a -1/-1 counter on target creature.');

export const GNARLED_EFFIGY_SCRIPT: CardScript = {
  oracleId: GNARLED_EFFIGY.oracleId,
  name: GNARLED_EFFIGY.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GNARLED_EFFIGY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '-1/-1', delta: 1 }] }];
      },
    },
  ],
};
