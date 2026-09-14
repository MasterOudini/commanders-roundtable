// `Vessel of Endless Rest` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VESSEL_OF_ENDLESS_REST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VESSEL_OF_ENDLESS_REST, "When this artifact enters, put target card from a graveyard on the bottom of its owner's library.\n{T}: Add one mana of any color.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put target card from a graveyard on the bottom of its owner's library.", VESSEL_OF_ENDLESS_REST.name);
const VOCAB_T_L0 = vocabularyTargets("Put target card from a graveyard on the bottom of its owner's library.");

export const VESSEL_OF_ENDLESS_REST_SCRIPT: CardScript = {
  oracleId: VESSEL_OF_ENDLESS_REST.oracleId,
  name: VESSEL_OF_ENDLESS_REST.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Vessel of Endless Rest - Put target card from a graveyard on the bottom of its owner's library.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
