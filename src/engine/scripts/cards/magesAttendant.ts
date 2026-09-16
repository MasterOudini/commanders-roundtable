// `Mage's Attendant` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAGE_S_ATTENDANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAGE_S_ATTENDANT, "When this creature enters, create a 1/1 blue Wizard creature token with \"{1}, Sacrifice this token: Counter target noncreature spell unless its controller pays {1}.\"");

const VOCAB_L0 = vocabularyEffects("Create a 1/1 blue Wizard creature token with \"{1}, Sacrifice this token: Counter target noncreature spell unless its controller pays {1}.\"", MAGE_S_ATTENDANT.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 1/1 blue Wizard creature token with \"{1}, Sacrifice this token: Counter target noncreature spell unless its controller pays {1}.\"");

export const MAGES_ATTENDANT_SCRIPT: CardScript = {
  oracleId: MAGE_S_ATTENDANT.oracleId,
  name: MAGE_S_ATTENDANT.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Mage's Attendant - Create a 1/1 blue Wizard creature token with \"{1}, Sacrifice this token: Counter target noncreature spell unless its controller pays {1}.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
