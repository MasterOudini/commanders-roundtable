// `Gila Courser` - a attacksWhileSaddled trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GILA_COURSER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GILA_COURSER, "Whenever this creature attacks while saddled, exile the top card of your library. Until the end of your next turn, you may play that card.\nSaddle 1 (Tap any number of other creatures you control with total power 1 or more: This Mount becomes saddled until end of turn. Saddle only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile the top card of your library. Until the end of your next turn, you may play that card.", GILA_COURSER.name);
const VOCAB_T_L0 = vocabularyTargets("Exile the top card of your library. Until the end of your next turn, you may play that card.");

export const GILA_COURSER_SCRIPT: CardScript = {
  oracleId: GILA_COURSER.oracleId,
  name: GILA_COURSER.name,
  triggers: [
    {
      abilityId: 'attacksWhileSaddled-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ctx.state.untilEndOfTurn.some((m) => m.card === self && m.saddled === true),
      label: () => "Gila Courser - Exile the top card of your library. Until the end of your next turn, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
