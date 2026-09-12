// `Tenth District Veteran` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TENTH_DISTRICT_VETERAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TENTH_DISTRICT_VETERAN, "Vigilance\nWhenever this creature attacks, untap another target creature you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Untap another target creature you control.", TENTH_DISTRICT_VETERAN.name);
const VOCAB_T_L1 = vocabularyTargets("Untap another target creature you control.");

export const TENTH_DISTRICT_VETERAN_SCRIPT: CardScript = {
  oracleId: TENTH_DISTRICT_VETERAN.oracleId,
  name: TENTH_DISTRICT_VETERAN.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Tenth District Veteran - Untap another target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
