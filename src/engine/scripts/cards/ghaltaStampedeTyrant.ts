// `Ghalta, Stampede Tyrant` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHALTA_STAMPEDE_TYRANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHALTA_STAMPEDE_TYRANT, "Trample\nWhen Ghalta enters, put any number of creature cards from your hand onto the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put any number of creature cards from your hand onto the battlefield.", GHALTA_STAMPEDE_TYRANT.name);
const VOCAB_T_L1 = vocabularyTargets("Put any number of creature cards from your hand onto the battlefield.");

export const GHALTA_STAMPEDE_TYRANT_SCRIPT: CardScript = {
  oracleId: GHALTA_STAMPEDE_TYRANT.oracleId,
  name: GHALTA_STAMPEDE_TYRANT.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ghalta, Stampede Tyrant - Put any number of creature cards from your hand onto the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
