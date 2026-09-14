// `Desecration Elemental` - a aPlayerCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DESECRATION_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DESECRATION_ELEMENTAL, "Fear (This creature can't be blocked except by artifact creatures and/or black creatures.)\nWhenever a player casts a spell, sacrifice a creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Sacrifice a creature.", DESECRATION_ELEMENTAL.name);
const VOCAB_T_L1 = vocabularyTargets("Sacrifice a creature.");

export const DESECRATION_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: DESECRATION_ELEMENTAL.oracleId,
  name: DESECRATION_ELEMENTAL.name,
  triggers: [
    {
      abilityId: 'aPlayerCastsSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'SpellCast',
      label: () => "Desecration Elemental - Sacrifice a creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
