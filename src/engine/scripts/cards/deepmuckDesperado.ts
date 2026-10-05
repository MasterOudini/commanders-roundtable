// `Deepmuck Desperado` - a youCommitCrime trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEEPMUCK_DESPERADO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEEPMUCK_DESPERADO, "Whenever you commit a crime, each opponent mills three cards. This ability triggers only once each turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)");

const VOCAB_L0 = vocabularyEffects("Each opponent mills three cards.", DEEPMUCK_DESPERADO.name);
const VOCAB_T_L0 = vocabularyTargets("Each opponent mills three cards.");

export const DEEPMUCK_DESPERADO_SCRIPT: CardScript = {
  oracleId: DEEPMUCK_DESPERADO.oracleId,
  name: DEEPMUCK_DESPERADO.name,
  triggers: [
    {
      abilityId: 'youCommitCrime-0',
      text: PRINTED,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Deepmuck Desperado - Each opponent mills three cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
