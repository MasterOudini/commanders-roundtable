// `Glimmerpoint Stag` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLIMMERPOINT_STAG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLIMMERPOINT_STAG, "Vigilance\nWhen this creature enters, exile another target permanent. Return that card to the battlefield under its owner's control at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile another target permanent. Return that card to the battlefield under its owner's control at the beginning of the next end step.", GLIMMERPOINT_STAG.name);
const VOCAB_T_L1 = vocabularyTargets("Exile another target permanent. Return that card to the battlefield under its owner's control at the beginning of the next end step.");

export const GLIMMERPOINT_STAG_SCRIPT: CardScript = {
  oracleId: GLIMMERPOINT_STAG.oracleId,
  name: GLIMMERPOINT_STAG.name,
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
      label: () => "Glimmerpoint Stag - Exile another target permanent. Return that card to the battlefield under its owner's control at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
