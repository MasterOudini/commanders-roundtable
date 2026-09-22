// `Bristling Hydra` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRISTLING_HYDRA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRISTLING_HYDRA, "When this creature enters, you get {E}{E}{E} (three energy counters).\nPay {E}{E}{E}: Put a +1/+1 counter on this creature. It gains hexproof until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}{E}{E}.", BRISTLING_HYDRA.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}{E}.");
const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on this creature. It gains hexproof until end of turn.", BRISTLING_HYDRA.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on this creature. It gains hexproof until end of turn.");

export const BRISTLING_HYDRA_SCRIPT: CardScript = {
  oracleId: BRISTLING_HYDRA.oracleId,
  name: BRISTLING_HYDRA.name,
  activated: [
    {
      ref: `${BRISTLING_HYDRA.oracleId}#a0`,
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
      label: () => "Bristling Hydra - You get {E}{E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
