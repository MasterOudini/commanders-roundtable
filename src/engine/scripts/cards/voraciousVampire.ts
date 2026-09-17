// `Voracious Vampire` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VORACIOUS_VAMPIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VORACIOUS_VAMPIRE, "Menace\nWhen this creature enters, target Vampire you control gets +1/+1 and gains menace until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target Vampire you control gets +1/+1 and gains menace until end of turn.", VORACIOUS_VAMPIRE.name);
const VOCAB_T_L1 = vocabularyTargets("Target Vampire you control gets +1/+1 and gains menace until end of turn.");

export const VORACIOUS_VAMPIRE_SCRIPT: CardScript = {
  oracleId: VORACIOUS_VAMPIRE.oracleId,
  name: VORACIOUS_VAMPIRE.name,
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
      label: () => "Voracious Vampire - Target Vampire you control gets +1/+1 and gains menace until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
