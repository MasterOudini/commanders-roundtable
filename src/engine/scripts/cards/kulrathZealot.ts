// `Kulrath Zealot` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KULRATH_ZEALOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KULRATH_ZEALOT, "When this creature enters, exile the top card of your library. Until the end of your next turn, you may play that card.\nBasic landcycling {1}{R} ({1}{R}, Discard this card: Search your library for a basic land card, reveal it, put it into your hand, then shuffle.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile the top card of your library. Until the end of your next turn, you may play that card.", KULRATH_ZEALOT.name);
const VOCAB_T_L0 = vocabularyTargets("Exile the top card of your library. Until the end of your next turn, you may play that card.");

export const KULRATH_ZEALOT_SCRIPT: CardScript = {
  oracleId: KULRATH_ZEALOT.oracleId,
  name: KULRATH_ZEALOT.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Kulrath Zealot - Exile the top card of your library. Until the end of your next turn, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
