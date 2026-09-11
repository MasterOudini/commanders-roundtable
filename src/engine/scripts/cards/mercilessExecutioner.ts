// `Merciless Executioner` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MERCILESS_EXECUTIONER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MERCILESS_EXECUTIONER, "When this creature enters, each player sacrifices a creature of their choice.");

const VOCAB_L0 = vocabularyEffects("Each player sacrifices a creature of their choice.", MERCILESS_EXECUTIONER.name);
const VOCAB_T_L0 = vocabularyTargets("Each player sacrifices a creature of their choice.");

export const MERCILESS_EXECUTIONER_SCRIPT: CardScript = {
  oracleId: MERCILESS_EXECUTIONER.oracleId,
  name: MERCILESS_EXECUTIONER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Merciless Executioner - Each player sacrifices a creature of their choice.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
