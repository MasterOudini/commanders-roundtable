// `Cloistered Youth // Unholy Fiend` - a upkeep trigger vocab, a endStep trigger loseLifeSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLOISTERED_YOUTH_UNHOLY_FIEND } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(CLOISTERED_YOUTH_UNHOLY_FIEND, "At the beginning of your upkeep, you may transform this creature.\nAt the beginning of your end step, you lose 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = transformFrom(vocabularyEffects("Transform this creature.", CLOISTERED_YOUTH_UNHOLY_FIEND.name), 0);
const VOCAB_T_L0 = vocabularyTargets("Transform this creature.");

export const CLOISTERED_YOUTH_UNHOLY_FIEND_SCRIPT: CardScript = {
  oracleId: CLOISTERED_YOUTH_UNHOLY_FIEND.oracleId,
  name: CLOISTERED_YOUTH_UNHOLY_FIEND.name,
  triggers: [
    {
      abilityId: 'upkeep-0', face: 0,
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Cloistered Youth // Unholy Fiend - Transform this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'endStep-1', face: 1,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Cloistered Youth // Unholy Fiend - loseLifeSelf",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
};
