// `Eye of Vecna` - a etb trigger drawLose, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EYE_OF_VECNA } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(EYE_OF_VECNA, "When Eye of Vecna enters, you draw a card and you lose 2 life.\nAt the beginning of your upkeep, you may pay {2}. If you do, you draw a card and you lose 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {2}. If you do, you draw a card and you lose 2 life.", EYE_OF_VECNA.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {2}. If you do, you draw a card and you lose 2 life.");

export const EYE_OF_VECNA_SCRIPT: CardScript = {
  oracleId: EYE_OF_VECNA.oracleId,
  name: EYE_OF_VECNA.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Eye of Vecna - drawLose",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -2, to: me.life - 2 }];
      },
    },
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Eye of Vecna - You may pay {2}. If you do, you draw a card and you lose 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
