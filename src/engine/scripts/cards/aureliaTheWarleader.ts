// `Aurelia, the Warleader` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AURELIA_THE_WARLEADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AURELIA_THE_WARLEADER, "Flying, vigilance, haste\nWhenever Aurelia attacks for the first time each turn, untap all creatures you control. After this phase, there is an additional combat phase.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Untap all creatures you control. After this phase, there is an additional combat phase.", AURELIA_THE_WARLEADER.name);
const VOCAB_T_L1 = vocabularyTargets("Untap all creatures you control. After this phase, there is an additional combat phase.");

export const AURELIA_THE_WARLEADER_SCRIPT: CardScript = {
  oracleId: AURELIA_THE_WARLEADER.oracleId,
  name: AURELIA_THE_WARLEADER.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Aurelia, the Warleader - Untap all creatures you control. After this phase, there is an additional combat phase.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
