// `Urza's Chalice` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { URZA_S_CHALICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(URZA_S_CHALICE, "Whenever a player casts an artifact spell, you may pay {1}. If you do, you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, you gain 1 life.", URZA_S_CHALICE.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, you gain 1 life.");

export const URZAS_CHALICE_SCRIPT: CardScript = {
  oracleId: URZA_S_CHALICE.oracleId,
  name: URZA_S_CHALICE.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Urza's Chalice - You may pay {1}. If you do, you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
