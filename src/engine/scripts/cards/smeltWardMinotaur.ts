// `Smelt-Ward Minotaur` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SMELT_WARD_MINOTAUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SMELT_WARD_MINOTAUR, "Whenever you cast an instant or sorcery spell, target creature an opponent controls can't block this turn.");

const VOCAB_L0 = vocabularyEffects("Target creature an opponent controls can't block this turn.", SMELT_WARD_MINOTAUR.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature an opponent controls can't block this turn.");

export const SMELT_WARD_MINOTAUR_SCRIPT: CardScript = {
  oracleId: SMELT_WARD_MINOTAUR.oracleId,
  name: SMELT_WARD_MINOTAUR.name,
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
      label: () => "Smelt-Ward Minotaur - Target creature an opponent controls can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
