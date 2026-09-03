// `Spurred Wolverine` — tapping two untapped Beasts I control (the D286 tap
// chooser; the Wolverine is a Beast) gives a creature first strike until
// cleanup.

import { SPURRED_WOLVERINE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SPURRED_WOLVERINE, 'Tap two untapped Beasts you control: Target creature gains first strike until end of turn.');

export const SPURRED_WOLVERINE_SCRIPT: CardScript = {
  oracleId: SPURRED_WOLVERINE.oracleId,
  name: SPURRED_WOLVERINE.name,
  activated: [
    {
      ref: `${SPURRED_WOLVERINE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['firstStrike'] }];
      },
    },
  ],
};
