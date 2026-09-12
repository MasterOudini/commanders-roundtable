// `Triceraton Regenta` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRICERATON_REGENTA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRICERATON_REGENTA, "Vigilance (Attacking doesn't cause this creature to tap.)\nWhenever this creature attacks, untap up to one other target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Untap up to one other target creature.", TRICERATON_REGENTA.name);
const VOCAB_T_L1 = vocabularyTargets("Untap up to one other target creature.");

export const TRICERATON_REGENTA_SCRIPT: CardScript = {
  oracleId: TRICERATON_REGENTA.oracleId,
  name: TRICERATON_REGENTA.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Triceraton Regenta - Untap up to one other target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
