// `Eel-Hounds` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EEL_HOUNDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EEL_HOUNDS, "Trample (This creature can deal excess combat damage to the player it's attacking.)\nWhenever this creature attacks, another target creature you control gets +2/+2 and gains trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Another target creature you control gets +2/+2 and gains trample until end of turn.", EEL_HOUNDS.name);
const VOCAB_T_L1 = vocabularyTargets("Another target creature you control gets +2/+2 and gains trample until end of turn.");

export const EEL_HOUNDS_SCRIPT: CardScript = {
  oracleId: EEL_HOUNDS.oracleId,
  name: EEL_HOUNDS.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Eel-Hounds - Another target creature you control gets +2/+2 and gains trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
