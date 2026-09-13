// `Biomechan Engineer` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BIOMECHAN_ENGINEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BIOMECHAN_ENGINEER, "When this creature enters, create a Lander token. (It's an artifact with \"{2}, {T}, Sacrifice this token: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\")\n{8}: Draw two cards and create a 2/2 colorless Robot artifact creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create a Lander token.", BIOMECHAN_ENGINEER.name);
const VOCAB_T_L0 = vocabularyTargets("Create a Lander token.");
const VOCAB_A0 = vocabularyEffects("Draw two cards and create a 2/2 colorless Robot artifact creature token.", BIOMECHAN_ENGINEER.name);
const VOCAB_T_A0 = vocabularyTargets("Draw two cards and create a 2/2 colorless Robot artifact creature token.");

export const BIOMECHAN_ENGINEER_SCRIPT: CardScript = {
  oracleId: BIOMECHAN_ENGINEER.oracleId,
  name: BIOMECHAN_ENGINEER.name,
  activated: [
    {
      ref: `${BIOMECHAN_ENGINEER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Biomechan Engineer - Create a Lander token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
