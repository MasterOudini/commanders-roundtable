// `Mold Demon` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOLD_DEMON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOLD_DEMON, "When this creature enters, sacrifice it unless you sacrifice two Swamps.");

const VOCAB_L0 = vocabularyEffects("Sacrifice it unless you sacrifice two Swamps.", MOLD_DEMON.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice it unless you sacrifice two Swamps.");

export const MOLD_DEMON_SCRIPT: CardScript = {
  oracleId: MOLD_DEMON.oracleId,
  name: MOLD_DEMON.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Mold Demon - Sacrifice it unless you sacrifice two Swamps.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
