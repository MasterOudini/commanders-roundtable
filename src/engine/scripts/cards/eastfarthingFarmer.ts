// `Eastfarthing Farmer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EASTFARTHING_FARMER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(EASTFARTHING_FARMER, "When this creature enters, create a Food token. When you do, target creature you control gets +1/+1 until end of turn for each Food you control. (A Food token is an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")");

const VOCAB_L0 = vocabularyEffects("Create a Food token. When you do, target creature you control gets +1/+1 until end of turn for each Food you control.", EASTFARTHING_FARMER.name);
const VOCAB_T_L0 = vocabularyTargets("Create a Food token. When you do, target creature you control gets +1/+1 until end of turn for each Food you control.");

export const EASTFARTHING_FARMER_SCRIPT: CardScript = {
  oracleId: EASTFARTHING_FARMER.oracleId,
  name: EASTFARTHING_FARMER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Eastfarthing Farmer - Create a Food token. When you do, target creature you control gets +1/+1 until end of turn for each Food you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
