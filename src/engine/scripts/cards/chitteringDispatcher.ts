// `Chittering Dispatcher` - a leavesBattlefield trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHITTERING_DISPATCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHITTERING_DISPATCHER, "Devoid (This card has no color.)\nMyriad\nWhen this creature leaves the battlefield, create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"", CHITTERING_DISPATCHER.name);
const VOCAB_T_L2 = vocabularyTargets("Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"");

export const CHITTERING_DISPATCHER_SCRIPT: CardScript = {
  oracleId: CHITTERING_DISPATCHER.oracleId,
  name: CHITTERING_DISPATCHER.name,
  triggers: [
    {
      abilityId: 'leavesBattlefield-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Chittering Dispatcher - Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
