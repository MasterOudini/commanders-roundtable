// `Reito Sentinel` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { REITO_SENTINEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(REITO_SENTINEL, "Defender\nWhen this creature enters, target player mills three cards. (They put the top three cards of their library into their graveyard.)\n{3}: Put target card from a graveyard on the bottom of its owner's library.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player mills three cards.", REITO_SENTINEL.name);
const VOCAB_T_L1 = vocabularyTargets("Target player mills three cards.");
const VOCAB_A0 = vocabularyEffects("Put target card from a graveyard on the bottom of its owner's library.", REITO_SENTINEL.name);
const VOCAB_T_A0 = vocabularyTargets("Put target card from a graveyard on the bottom of its owner's library.");

export const REITO_SENTINEL_SCRIPT: CardScript = {
  oracleId: REITO_SENTINEL.oracleId,
  name: REITO_SENTINEL.name,
  activated: [
    {
      ref: `${REITO_SENTINEL.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Reito Sentinel - Target player mills three cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
