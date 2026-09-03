// `Skaab Wrangler` — tapping three untapped creatures I control (the D286
// tap chooser, count three) taps a target creature.

import { SKAAB_WRANGLER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SKAAB_WRANGLER, 'Tap three untapped creatures you control: Tap target creature.');

export const SKAAB_WRANGLER_SCRIPT: CardScript = {
  oracleId: SKAAB_WRANGLER.oracleId,
  name: SKAAB_WRANGLER.name,
  activated: [
    {
      ref: `${SKAAB_WRANGLER.oracleId}#a0`,
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
