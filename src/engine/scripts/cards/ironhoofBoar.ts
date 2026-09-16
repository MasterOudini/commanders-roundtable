// `Ironhoof Boar` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IRONHOOF_BOAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IRONHOOF_BOAR, "Trample, haste\nChannel — {1}{R}, Discard this card: Target creature gets +3/+1 and gains trample until end of turn.");
const LINES = PRINTED.split('\n');

export const IRONHOOF_BOAR_SCRIPT: CardScript = {
  oracleId: IRONHOOF_BOAR.oracleId,
  name: IRONHOOF_BOAR.name,
  activated: [
    {
      ref: `${IRONHOOF_BOAR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 3, toughness: 1, keywords: ["trample"] }];
      },
    },
  ],
};
