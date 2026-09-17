// `Venser, the Sojourner Emblem` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VENSER_THE_SOJOURNER_EMBLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VENSER_THE_SOJOURNER_EMBLEM, "Whenever you cast a spell, exile target permanent.");

const VOCAB_L0 = vocabularyEffects("Exile target permanent.", VENSER_THE_SOJOURNER_EMBLEM.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target permanent.");

export const VENSER_THE_SOJOURNER_EMBLEMC9AD6E7A_SCRIPT: CardScript = {
  oracleId: VENSER_THE_SOJOURNER_EMBLEM.oracleId,
  name: VENSER_THE_SOJOURNER_EMBLEM.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['command'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self),
      label: () => "Venser, the Sojourner Emblem - Exile target permanent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
