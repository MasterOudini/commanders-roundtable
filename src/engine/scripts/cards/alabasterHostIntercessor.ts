// `Alabaster Host Intercessor` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALABASTER_HOST_INTERCESSOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALABASTER_HOST_INTERCESSOR, "When this creature enters, exile target creature an opponent controls until this creature leaves the battlefield.\nPlainscycling {2} ({2}, Discard this card: Search your library for a Plains card, reveal it, put it into your hand, then shuffle.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile target creature an opponent controls until this creature leaves the battlefield.", ALABASTER_HOST_INTERCESSOR.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target creature an opponent controls until this creature leaves the battlefield.");

export const ALABASTER_HOST_INTERCESSOR_SCRIPT: CardScript = {
  oracleId: ALABASTER_HOST_INTERCESSOR.oracleId,
  name: ALABASTER_HOST_INTERCESSOR.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Alabaster Host Intercessor - Exile target creature an opponent controls until this creature leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
