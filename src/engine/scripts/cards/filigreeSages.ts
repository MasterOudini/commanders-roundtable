// `Filigree Sages` — "{2}{U}: Untap target artifact." The untap mirror of
// the tap actives — an UNTAPPED target gets no event (Auriok's guard
// reversed, D162). M6.4s, D175.

import { FILIGREE_SAGES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FILIGREE_SAGES, '{2}{U}: Untap target artifact.');

export const FILIGREE_SAGES_SCRIPT: CardScript = {
  oracleId: FILIGREE_SAGES.oracleId,
  name: FILIGREE_SAGES.name,
  activated: [
    {
      ref: `${FILIGREE_SAGES.oracleId}#a0`,
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
