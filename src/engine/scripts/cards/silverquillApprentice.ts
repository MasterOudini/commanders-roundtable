// `Silverquill Apprentice` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SILVERQUILL_APPRENTICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SILVERQUILL_APPRENTICE, "Magecraft — Whenever you cast or copy an instant or sorcery spell, target creature gets +1/+0 until end of turn.");

const VOCAB_L0 = vocabularyEffects("Target creature gets +1/+0 until end of turn.", SILVERQUILL_APPRENTICE.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature gets +1/+0 until end of turn.");

export const SILVERQUILL_APPRENTICE_SCRIPT: CardScript = {
  oracleId: SILVERQUILL_APPRENTICE.oracleId,
  name: SILVERQUILL_APPRENTICE.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Silverquill Apprentice - Target creature gets +1/+0 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
