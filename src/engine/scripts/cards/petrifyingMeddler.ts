// `Petrifying Meddler` - a castThisSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PETRIFYING_MEDDLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PETRIFYING_MEDDLER, "Devoid (This card has no color.)\nWhen you cast this spell, tap up to one target creature and put a stun counter on it. (If a permanent with a stun counter would become untapped, remove one from it instead.)\nReach");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Tap up to one target creature and put a stun counter on it.", PETRIFYING_MEDDLER.name);
const VOCAB_T_L1 = vocabularyTargets("Tap up to one target creature and put a stun counter on it.");

export const PETRIFYING_MEDDLER_SCRIPT: CardScript = {
  oracleId: PETRIFYING_MEDDLER.oracleId,
  name: PETRIFYING_MEDDLER.name,
  triggers: [
    {
      abilityId: 'castThisSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ["stack"],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self,
      label: () => "Petrifying Meddler - Tap up to one target creature and put a stun counter on it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
