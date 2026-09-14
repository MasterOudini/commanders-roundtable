// `Diligent Excavator` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DILIGENT_EXCAVATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DILIGENT_EXCAVATOR, "Whenever you cast a historic spell, target player mills two cards. (Artifacts, legendaries, and Sagas are historic.)");

const VOCAB_L0 = vocabularyEffects("Target player mills two cards.", DILIGENT_EXCAVATOR.name);
const VOCAB_T_L0 = vocabularyTargets("Target player mills two cards.");

export const DILIGENT_EXCAVATOR_SCRIPT: CardScript = {
  oracleId: DILIGENT_EXCAVATOR.oracleId,
  name: DILIGENT_EXCAVATOR.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).typeLine.types.includes('Artifact') || ctx.derive(ev.obj.card).typeLine.supertypes.includes('Legendary') || ctx.derive(ev.obj.card).typeLine.subtypes.includes('Saga')),
      label: () => "Diligent Excavator - Target player mills two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
