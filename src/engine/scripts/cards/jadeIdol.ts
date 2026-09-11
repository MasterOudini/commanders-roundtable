// `Jade Idol` - a castSpiritOrArcane trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JADE_IDOL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JADE_IDOL, "Whenever you cast a Spirit or Arcane spell, this artifact becomes a 4/4 Spirit artifact creature until end of turn.");

const VOCAB_L0 = vocabularyEffects("This artifact becomes a 4/4 Spirit artifact creature until end of turn.", JADE_IDOL.name);
const VOCAB_T_L0 = vocabularyTargets("This artifact becomes a 4/4 Spirit artifact creature until end of turn.");

export const JADE_IDOL_SCRIPT: CardScript = {
  oracleId: JADE_IDOL.oracleId,
  name: JADE_IDOL.name,
  triggers: [
    {
      abilityId: 'castSpiritOrArcane-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.subtypes.some((t) => t === 'Spirit' || t === 'Arcane'),
      label: () => "Jade Idol - This artifact becomes a 4/4 Spirit artifact creature until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
