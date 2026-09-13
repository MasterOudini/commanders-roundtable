// `Horizon Seed` - a castSpiritOrArcane trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HORIZON_SEED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HORIZON_SEED, "Whenever you cast a Spirit or Arcane spell, regenerate target creature.");

const VOCAB_L0 = vocabularyEffects("Regenerate target creature.", HORIZON_SEED.name);
const VOCAB_T_L0 = vocabularyTargets("Regenerate target creature.");

export const HORIZON_SEED_SCRIPT: CardScript = {
  oracleId: HORIZON_SEED.oracleId,
  name: HORIZON_SEED.name,
  triggers: [
    {
      abilityId: 'castSpiritOrArcane-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.subtypes.some((t) => t === 'Spirit' || t === 'Arcane'),
      label: () => "Horizon Seed - Regenerate target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
