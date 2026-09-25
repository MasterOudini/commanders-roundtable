// `Infernal Captor` - a exploits trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INFERNAL_CAPTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INFERNAL_CAPTOR, "Exploit (When this creature enters, you may sacrifice a creature.)\nWhen this creature exploits a creature, gain control of target artifact or creature until end of turn. Untap that permanent. It gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Gain control of target artifact or creature until end of turn. Untap that permanent. It gains haste until end of turn.", INFERNAL_CAPTOR.name);
const VOCAB_T_L1 = vocabularyTargets("Gain control of target artifact or creature until end of turn. Untap that permanent. It gains haste until end of turn.");

export const INFERNAL_CAPTOR_SCRIPT: CardScript = {
  oracleId: INFERNAL_CAPTOR.oracleId,
  name: INFERNAL_CAPTOR.name,
  triggers: [
    {
      abilityId: 'exploits-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.exploitedBy === self),
      label: () => "Infernal Captor - Gain control of target artifact or creature until end of turn. Untap that permanent. It gains haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
