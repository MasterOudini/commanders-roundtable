// `Archon of the Triumvirate` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARCHON_OF_THE_TRIUMVIRATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCHON_OF_THE_TRIUMVIRATE, "Flying\nWhenever this creature attacks, detain up to two target nonland permanents your opponents control. (Until your next turn, those permanents can't attack or block and their activated abilities can't be activated.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Detain up to two target nonland permanents your opponents control.", ARCHON_OF_THE_TRIUMVIRATE.name);
const VOCAB_T_L1 = vocabularyTargets("Detain up to two target nonland permanents your opponents control.");

export const ARCHON_OF_THE_TRIUMVIRATE_SCRIPT: CardScript = {
  oracleId: ARCHON_OF_THE_TRIUMVIRATE.oracleId,
  name: ARCHON_OF_THE_TRIUMVIRATE.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Archon of the Triumvirate - Detain up to two target nonland permanents your opponents control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
