// `Minister of Impediments` — "{T}: Tap target creature." The SIXTH oracle
// id on the Benalish Trapper effect (Trapper, Blinding Mage, Gideon's
// Lawkeeper, Goldmeadow Harrier, Master Decoy before it); the hybrid-cost
// reminder line above the ability is scrubbed, so the tap is #a0. D225.

import { MINISTER_OF_IMPEDIMENTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  MINISTER_OF_IMPEDIMENTS,
  '({W/U} can be paid with either {W} or {U}.)\n{T}: Tap target creature.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const MINISTER_OF_IMPEDIMENTS_SCRIPT: CardScript = {
  oracleId: MINISTER_OF_IMPEDIMENTS.oracleId,
  name: MINISTER_OF_IMPEDIMENTS.name,
  activated: [
    {
      ref: `${MINISTER_OF_IMPEDIMENTS.oracleId}#a0`,
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
