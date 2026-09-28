// `Captive Weird // Compleated Conjurer` - an activation vocab, a transformsInto trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTIVE_WEIRD_COMPLEATED_CONJURER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(CAPTIVE_WEIRD_COMPLEATED_CONJURER, "Defender\n{3}{R/P}: Transform this creature. Activate only as a sorcery. ({R/P} can be paid with either {R} or 2 life.)\nWhen this creature transforms into Compleated Conjurer, exile the top card of your library. Until the end of your next turn, you may play that card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", CAPTIVE_WEIRD_COMPLEATED_CONJURER.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");
const VOCAB_L2 = vocabularyEffects("Exile the top card of your library. Until the end of your next turn, you may play that card.", CAPTIVE_WEIRD_COMPLEATED_CONJURER.name);
const VOCAB_T_L2 = vocabularyTargets("Exile the top card of your library. Until the end of your next turn, you may play that card.");

export const CAPTIVE_WEIRD_COMPLEATED_CONJURER_SCRIPT: CardScript = {
  oracleId: CAPTIVE_WEIRD_COMPLEATED_CONJURER.oracleId,
  name: CAPTIVE_WEIRD_COMPLEATED_CONJURER.name,
  activated: [
    {
      ref: `${CAPTIVE_WEIRD_COMPLEATED_CONJURER.oracleId}#a0`, face: 0,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'transformsInto-2', face: 1,
      text: LINES[2] as string,
      event: 'FaceIndexSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'FaceIndexSet' && ev.card === self,
      label: () => "Captive Weird // Compleated Conjurer - Exile the top card of your library. Until the end of your next turn, you may play that card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
