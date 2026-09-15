// `Howling Banshee` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOWLING_BANSHEE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOWLING_BANSHEE, "Flying\nWhen this creature enters, each player loses 3 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each player loses 3 life.", HOWLING_BANSHEE.name);
const VOCAB_T_L1 = vocabularyTargets("Each player loses 3 life.");

export const HOWLING_BANSHEE_SCRIPT: CardScript = {
  oracleId: HOWLING_BANSHEE.oracleId,
  name: HOWLING_BANSHEE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Howling Banshee - Each player loses 3 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
