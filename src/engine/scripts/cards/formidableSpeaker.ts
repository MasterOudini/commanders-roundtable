// `Formidable Speaker` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORMIDABLE_SPEAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORMIDABLE_SPEAKER, "When this creature enters, you may discard a card. If you do, search your library for a creature card, reveal it, put it into your hand, then shuffle.\n{1}, {T}: Untap another target permanent.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may discard a card. If you do, search your library for a creature card, reveal it, put it into your hand, then shuffle.", FORMIDABLE_SPEAKER.name);
const VOCAB_T_L0 = vocabularyTargets("You may discard a card. If you do, search your library for a creature card, reveal it, put it into your hand, then shuffle.");
const VOCAB_A0 = vocabularyEffects("Untap another target permanent.", FORMIDABLE_SPEAKER.name);
const VOCAB_T_A0 = vocabularyTargets("Untap another target permanent.");

export const FORMIDABLE_SPEAKER_SCRIPT: CardScript = {
  oracleId: FORMIDABLE_SPEAKER.oracleId,
  name: FORMIDABLE_SPEAKER.name,
  activated: [
    {
      ref: `${FORMIDABLE_SPEAKER.oracleId}#a0`,
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
      label: () => "Formidable Speaker - You may discard a card. If you do, search your library for a creature card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
