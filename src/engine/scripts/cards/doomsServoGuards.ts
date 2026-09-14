// `Doom's Servo-Guards` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOOM_S_SERVO_GUARDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DOOM_S_SERVO_GUARDS, "When this creature enters, you gain 2 life and mill two cards. (Put the top two cards of your library into your graveyard.)");

const VOCAB_L0 = vocabularyEffects("You gain 2 life and mill two cards.", DOOM_S_SERVO_GUARDS.name);
const VOCAB_T_L0 = vocabularyTargets("You gain 2 life and mill two cards.");

export const DOOMS_SERVO_GUARDS_SCRIPT: CardScript = {
  oracleId: DOOM_S_SERVO_GUARDS.oracleId,
  name: DOOM_S_SERVO_GUARDS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Doom's Servo-Guards - You gain 2 life and mill two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
