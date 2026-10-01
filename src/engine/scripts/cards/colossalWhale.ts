// `Colossal Whale` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COLOSSAL_WHALE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COLOSSAL_WHALE, "Islandwalk (This creature can't be blocked as long as defending player controls an Island.)\nWhenever this creature attacks, you may exile target creature defending player controls until this creature leaves the battlefield. (That creature returns under its owner's control.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile target creature defending player controls until this creature leaves the battlefield.", COLOSSAL_WHALE.name);
const VOCAB_T_L1 = vocabularyTargets("Exile target creature defending player controls until this creature leaves the battlefield.");

export const COLOSSAL_WHALE_SCRIPT: CardScript = {
  oracleId: COLOSSAL_WHALE.oracleId,
  name: COLOSSAL_WHALE.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Colossal Whale - Exile target creature defending player controls until this creature leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
