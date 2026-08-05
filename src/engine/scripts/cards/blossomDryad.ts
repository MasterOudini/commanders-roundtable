// `Blossom Dryad` — "{T}: Untap target land." Deserted Temple's untap on a
// creature body. M6.4h, D165.

import { BLOSSOM_DRYAD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BLOSSOM_DRYAD, '{T}: Untap target land.');

export const BLOSSOM_DRYAD_SCRIPT: CardScript = {
  oracleId: BLOSSOM_DRYAD.oracleId,
  name: BLOSSOM_DRYAD.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BLOSSOM_DRYAD.oracleId}#a0`,
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
