// `S.H.I.E.L.D. Flying Car` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { S_H_I_E_L_D_FLYING_CAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(S_H_I_E_L_D_FLYING_CAR, "Flash\nFlying\nWhen this Vehicle enters, exile up to one target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.\nCrew 1");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Exile up to one target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.", S_H_I_E_L_D_FLYING_CAR.name);
const VOCAB_T_L2 = vocabularyTargets("Exile up to one target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.");

export const S_HIELDFLYING_CAR_SCRIPT: CardScript = {
  oracleId: S_H_I_E_L_D_FLYING_CAR.oracleId,
  name: S_H_I_E_L_D_FLYING_CAR.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "S.H.I.E.L.D. Flying Car - Exile up to one target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
