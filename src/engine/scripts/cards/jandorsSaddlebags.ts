// `Jandor's Saddlebags` — "{3}, {T}: Untap target creature." Filigree
// Sages' targeted untap on an artifact; an upright target gets no event.
// M6.4z, D182.

import { JANDOR_S_SADDLEBAGS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(JANDOR_S_SADDLEBAGS, '{3}, {T}: Untap target creature.');

export const JANDORS_SADDLEBAGS_SCRIPT: CardScript = {
  oracleId: JANDOR_S_SADDLEBAGS.oracleId,
  name: JANDOR_S_SADDLEBAGS.name,
  activated: [
    {
      ref: `${JANDOR_S_SADDLEBAGS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || !card.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [target.id] }];
      },
    },
  ],
};
