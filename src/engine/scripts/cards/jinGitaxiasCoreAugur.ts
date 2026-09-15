// `Jin-Gitaxias, Core Augur` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JIN_GITAXIAS_CORE_AUGUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JIN_GITAXIAS_CORE_AUGUR, "Flash\nAt the beginning of your end step, draw seven cards.\nEach opponent's maximum hand size is reduced by seven.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Draw seven cards.", JIN_GITAXIAS_CORE_AUGUR.name);
const VOCAB_T_L1 = vocabularyTargets("Draw seven cards.");

export const JIN_GITAXIAS_CORE_AUGUR_SCRIPT: CardScript = {
  oracleId: JIN_GITAXIAS_CORE_AUGUR.oracleId,
  name: JIN_GITAXIAS_CORE_AUGUR.name,
  triggers: [
    {
      abilityId: 'endStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Jin-Gitaxias, Core Augur - Draw seven cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
