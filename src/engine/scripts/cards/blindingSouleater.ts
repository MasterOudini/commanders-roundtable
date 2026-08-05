// `Blinding Souleater` — "{W/P}, {T}: Tap target creature." The first
// PHYREXIAN activation cost a shipped def charges — the payment problem has
// modelled phyrexian halves since M3 (a {W/P} can be paid in white or 2
// life), and the per-card test drives the white path. M6.4g, D164.

import { BLINDING_SOULEATER } from '../../../data/fixtures/engineCards';
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
  BLINDING_SOULEATER,
  '{W/P}, {T}: Tap target creature. ({W/P} can be paid with either {W} or 2 life.)',
);

export const BLINDING_SOULEATER_SCRIPT: CardScript = {
  oracleId: BLINDING_SOULEATER.oracleId,
  name: BLINDING_SOULEATER.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BLINDING_SOULEATER.oracleId}#a0`,
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
