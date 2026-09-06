// `Thistledown Players` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THISTLEDOWN_PLAYERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THISTLEDOWN_PLAYERS, "Whenever this creature attacks, untap target nonland permanent.");

const VOCAB_L0 = vocabularyEffects("Untap target nonland permanent.", THISTLEDOWN_PLAYERS.name);
const VOCAB_T_L0 = vocabularyTargets("Untap target nonland permanent.");

export const THISTLEDOWN_PLAYERS_SCRIPT: CardScript = {
  oracleId: THISTLEDOWN_PLAYERS.oracleId,
  name: THISTLEDOWN_PLAYERS.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Thistledown Players - Untap target nonland permanent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
