// `Checkpoint Officer` — "{1}{W}, {T}: Tap target creature." Benalish
// Trapper's shape, one generic dearer. M6.4j, D167.

import { CHECKPOINT_OFFICER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CHECKPOINT_OFFICER, '{1}{W}, {T}: Tap target creature.');

export const CHECKPOINT_OFFICER_SCRIPT: CardScript = {
  oracleId: CHECKPOINT_OFFICER.oracleId,
  name: CHECKPOINT_OFFICER.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${CHECKPOINT_OFFICER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
