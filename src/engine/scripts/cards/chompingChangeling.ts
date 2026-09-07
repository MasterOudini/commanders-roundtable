// `Chomping Changeling` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHOMPING_CHANGELING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHOMPING_CHANGELING, "Changeling (This card is every creature type.)\nWhen this creature enters, destroy up to one target artifact or enchantment.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy up to one target artifact or enchantment.", CHOMPING_CHANGELING.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy up to one target artifact or enchantment.");

export const CHOMPING_CHANGELING_SCRIPT: CardScript = {
  oracleId: CHOMPING_CHANGELING.oracleId,
  name: CHOMPING_CHANGELING.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Chomping Changeling - Destroy up to one target artifact or enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
