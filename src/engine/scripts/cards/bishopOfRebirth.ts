// `Bishop of Rebirth` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BISHOP_OF_REBIRTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BISHOP_OF_REBIRTH, "Vigilance\nWhenever this creature attacks, you may return target creature card with mana value 3 or less from your graveyard to the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target creature card with mana value 3 or less from your graveyard to the battlefield.", BISHOP_OF_REBIRTH.name);
const VOCAB_T_L1 = vocabularyTargets("Return target creature card with mana value 3 or less from your graveyard to the battlefield.");

export const BISHOP_OF_REBIRTH_SCRIPT: CardScript = {
  oracleId: BISHOP_OF_REBIRTH.oracleId,
  name: BISHOP_OF_REBIRTH.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Bishop of Rebirth - Return target creature card with mana value 3 or less from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
