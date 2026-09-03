// `Glare of Subdual` — tapping an untapped creature I control (the D286 tap
// chooser) taps a target artifact or creature.

import { GLARE_OF_SUBDUAL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GLARE_OF_SUBDUAL, 'Tap an untapped creature you control: Tap target artifact or creature.');

export const GLARE_OF_SUBDUAL_SCRIPT: CardScript = {
  oracleId: GLARE_OF_SUBDUAL.oracleId,
  name: GLARE_OF_SUBDUAL.name,
  activated: [
    {
      ref: `${GLARE_OF_SUBDUAL.oracleId}#a0`,
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
