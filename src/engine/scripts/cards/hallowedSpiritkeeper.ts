// `Hallowed Spiritkeeper` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HALLOWED_SPIRITKEEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HALLOWED_SPIRITKEEPER, "Vigilance\nWhen this creature dies, create X 1/1 white Spirit creature tokens with flying, where X is the number of creature cards in your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create X 1/1 white Spirit creature tokens with flying, where X is the number of creature cards in your graveyard.", HALLOWED_SPIRITKEEPER.name);
const VOCAB_T_L1 = vocabularyTargets("Create X 1/1 white Spirit creature tokens with flying, where X is the number of creature cards in your graveyard.");

export const HALLOWED_SPIRITKEEPER_SCRIPT: CardScript = {
  oracleId: HALLOWED_SPIRITKEEPER.oracleId,
  name: HALLOWED_SPIRITKEEPER.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Hallowed Spiritkeeper - Create X 1/1 white Spirit creature tokens with flying, where X is the number of creature cards in your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
