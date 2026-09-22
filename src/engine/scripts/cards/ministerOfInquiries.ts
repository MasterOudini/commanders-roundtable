// `Minister of Inquiries` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MINISTER_OF_INQUIRIES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MINISTER_OF_INQUIRIES, "When this creature enters, you get {E}{E} (two energy counters).\n{T}, Pay {E}: Target player mills three cards.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}{E}.", MINISTER_OF_INQUIRIES.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}.");
const VOCAB_A0 = vocabularyEffects("Target player mills three cards.", MINISTER_OF_INQUIRIES.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills three cards.");

export const MINISTER_OF_INQUIRIES_SCRIPT: CardScript = {
  oracleId: MINISTER_OF_INQUIRIES.oracleId,
  name: MINISTER_OF_INQUIRIES.name,
  activated: [
    {
      ref: `${MINISTER_OF_INQUIRIES.oracleId}#a0`,
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
      label: () => "Minister of Inquiries - You get {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
