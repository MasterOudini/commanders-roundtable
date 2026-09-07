// `Implement of Malice` - an activation vocab, a auraToGraveyard trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IMPLEMENT_OF_MALICE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(IMPLEMENT_OF_MALICE, "{B}, Sacrifice this artifact: Target player discards a card. Activate only as a sorcery.\nWhen this artifact is put into a graveyard from the battlefield, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player discards a card.", IMPLEMENT_OF_MALICE.name);
const VOCAB_T_A0 = vocabularyTargets("Target player discards a card.");

export const IMPLEMENT_OF_MALICE_SCRIPT: CardScript = {
  oracleId: IMPLEMENT_OF_MALICE.oracleId,
  name: IMPLEMENT_OF_MALICE.name,
  activated: [
    {
      ref: `${IMPLEMENT_OF_MALICE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'auraToGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Implement of Malice - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
