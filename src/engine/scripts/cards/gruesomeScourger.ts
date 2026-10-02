// `Gruesome Scourger` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRUESOME_SCOURGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRUESOME_SCOURGER, "When this creature enters, it deals damage to target opponent or planeswalker equal to the number of creatures you control.");

const VOCAB_L0 = vocabularyEffects("~ deals damage to target opponent or planeswalker equal to the number of creatures you control.", GRUESOME_SCOURGER.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals damage to target opponent or planeswalker equal to the number of creatures you control.");

export const GRUESOME_SCOURGER_SCRIPT: CardScript = {
  oracleId: GRUESOME_SCOURGER.oracleId,
  name: GRUESOME_SCOURGER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Gruesome Scourger - ~ deals damage to target opponent or planeswalker equal to the number of creatures you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
