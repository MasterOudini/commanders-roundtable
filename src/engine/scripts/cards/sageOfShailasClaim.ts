// `Sage of Shaila's Claim` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAGE_OF_SHAILA_S_CLAIM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAGE_OF_SHAILA_S_CLAIM, "When this creature enters, you get {E}{E}{E} (three energy counters).");

const VOCAB_L0 = vocabularyEffects("You get {E}{E}{E}.", SAGE_OF_SHAILA_S_CLAIM.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}{E}.");

export const SAGE_OF_SHAILAS_CLAIM_SCRIPT: CardScript = {
  oracleId: SAGE_OF_SHAILA_S_CLAIM.oracleId,
  name: SAGE_OF_SHAILA_S_CLAIM.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sage of Shaila's Claim - You get {E}{E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
