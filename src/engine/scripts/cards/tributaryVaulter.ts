// `Tributary Vaulter` - a becomesTapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRIBUTARY_VAULTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRIBUTARY_VAULTER, "Flying\nWhenever this creature becomes tapped, another target Merfolk you control gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Another target Merfolk you control gets +2/+0 until end of turn.", TRIBUTARY_VAULTER.name);
const VOCAB_T_L1 = vocabularyTargets("Another target Merfolk you control gets +2/+0 until end of turn.");

export const TRIBUTARY_VAULTER_SCRIPT: CardScript = {
  oracleId: TRIBUTARY_VAULTER.oracleId,
  name: TRIBUTARY_VAULTER.name,
  triggers: [
    {
      abilityId: 'becomesTapped-1',
      text: LINES[1] as string,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Tributary Vaulter - Another target Merfolk you control gets +2/+0 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
