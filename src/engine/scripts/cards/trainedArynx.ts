// `Trained Arynx` - a attacksWhileSaddled trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRAINED_ARYNX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRAINED_ARYNX, "Whenever this creature attacks while saddled, it gains first strike until end of turn. Scry 1. (Look at the top card of your library. You may put that card on the bottom.)\nSaddle 2 (Tap any number of other creatures you control with total power 2 or more: This Mount becomes saddled until end of turn. Saddle only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ gains first strike until end of turn. Scry 1.", TRAINED_ARYNX.name);
const VOCAB_T_L0 = vocabularyTargets("~ gains first strike until end of turn. Scry 1.");

export const TRAINED_ARYNX_SCRIPT: CardScript = {
  oracleId: TRAINED_ARYNX.oracleId,
  name: TRAINED_ARYNX.name,
  triggers: [
    {
      abilityId: 'attacksWhileSaddled-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ctx.state.untilEndOfTurn.some((m) => m.card === self && m.saddled === true),
      label: () => "Trained Arynx - ~ gains first strike until end of turn. Scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
