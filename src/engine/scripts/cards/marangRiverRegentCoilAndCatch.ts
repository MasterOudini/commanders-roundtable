// `Marang River Regent // Coil and Catch` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARANG_RIVER_REGENT_COIL_AND_CATCH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(MARANG_RIVER_REGENT_COIL_AND_CATCH, "Flying\nWhen this creature enters, return up to two other target nonland permanents to their owners' hands.\nDraw three cards, then discard a card. (Then shuffle this card into its owner's library.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return up to two other target nonland permanents to their owners' hands.", MARANG_RIVER_REGENT_COIL_AND_CATCH.name);
const VOCAB_T_L1 = vocabularyTargets("Return up to two other target nonland permanents to their owners' hands.");

export const MARANG_RIVER_REGENT_COIL_AND_CATCH_SCRIPT: CardScript = {
  oracleId: MARANG_RIVER_REGENT_COIL_AND_CATCH.oracleId,
  name: MARANG_RIVER_REGENT_COIL_AND_CATCH.name,
  triggers: [
    {
      abilityId: 'etb-1', face: 0,
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Marang River Regent // Coil and Catch - Return up to two other target nonland permanents to their owners' hands.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
