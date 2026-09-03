// `Aphetto Grifter` — tapping two untapped Wizards I control (the D286 tap
// chooser; the Grifter is a Wizard itself) taps a target permanent.

import { APHETTO_GRIFTER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(APHETTO_GRIFTER, 'Tap two untapped Wizards you control: Tap target permanent.');

export const APHETTO_GRIFTER_SCRIPT: CardScript = {
  oracleId: APHETTO_GRIFTER.oracleId,
  name: APHETTO_GRIFTER.name,
  activated: [
    {
      ref: `${APHETTO_GRIFTER.oracleId}#a0`,
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
