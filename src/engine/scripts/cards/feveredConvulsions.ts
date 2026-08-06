// `Fevered Convulsions` — "{2}{B}{B}: Put a -1/-1 counter on target
// creature." Dragon Blood's minus sibling on an enchantment, repeatable
// with no tap anywhere. M6.4r, D174.

import { FEVERED_CONVULSIONS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FEVERED_CONVULSIONS, '{2}{B}{B}: Put a -1/-1 counter on target creature.');

export const FEVERED_CONVULSIONS_SCRIPT: CardScript = {
  oracleId: FEVERED_CONVULSIONS.oracleId,
  name: FEVERED_CONVULSIONS.name,
  activated: [
    {
      ref: `${FEVERED_CONVULSIONS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '-1/-1', delta: 1 }] }];
      },
    },
  ],
};
