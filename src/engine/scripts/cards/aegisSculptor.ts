// `Aegis Sculptor` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AEGIS_SCULPTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AEGIS_SCULPTOR, "Flying\nWard {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\nAt the beginning of your upkeep, you may exile two cards from your graveyard. If you do, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You may exile two cards from your graveyard. If you do, put a +1/+1 counter on this creature.", AEGIS_SCULPTOR.name);
const VOCAB_T_L2 = vocabularyTargets("You may exile two cards from your graveyard. If you do, put a +1/+1 counter on this creature.");

export const AEGIS_SCULPTOR_SCRIPT: CardScript = {
  oracleId: AEGIS_SCULPTOR.oracleId,
  name: AEGIS_SCULPTOR.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Aegis Sculptor - You may exile two cards from your graveyard. If you do, put a +1/+1 counter on this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
