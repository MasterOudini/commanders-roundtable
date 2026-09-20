// `Loam Dweller` - a castSpiritOrArcane trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOAM_DWELLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOAM_DWELLER, "Whenever you cast a Spirit or Arcane spell, you may put a land card from your hand onto the battlefield tapped.");

const VOCAB_L0 = vocabularyEffects("Put a land card from your hand onto the battlefield tapped.", LOAM_DWELLER.name);
const VOCAB_T_L0 = vocabularyTargets("Put a land card from your hand onto the battlefield tapped.");

export const LOAM_DWELLER_SCRIPT: CardScript = {
  oracleId: LOAM_DWELLER.oracleId,
  name: LOAM_DWELLER.name,
  triggers: [
    {
      abilityId: 'castSpiritOrArcane-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.subtypes.some((t) => t === 'Spirit' || t === 'Arcane'),
      label: () => "Loam Dweller - Put a land card from your hand onto the battlefield tapped.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
