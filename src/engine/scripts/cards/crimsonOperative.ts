// `Crimson Operative` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRIMSON_OPERATIVE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRIMSON_OPERATIVE, "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nWhen this creature enters, exile the top card of your library. Until the end of your next turn, you may play that card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile the top card of your library. Until the end of your next turn, you may play that card.", CRIMSON_OPERATIVE.name);
const VOCAB_T_L1 = vocabularyTargets("Exile the top card of your library. Until the end of your next turn, you may play that card.");

export const CRIMSON_OPERATIVE_SCRIPT: CardScript = {
  oracleId: CRIMSON_OPERATIVE.oracleId,
  name: CRIMSON_OPERATIVE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Crimson Operative - Exile the top card of your library. Until the end of your next turn, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
