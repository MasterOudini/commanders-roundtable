// `Skyclave Aerialist // Skyclave Invader` - an activation vocab, a transformsInto trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYCLAVE_AERIALIST_SKYCLAVE_INVADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYCLAVE_AERIALIST_SKYCLAVE_INVADER, "Flying\n{4}{G/P}: Transform this creature. Activate only as a sorcery. ({G/P} can be paid with either {G} or 2 life.)\nFlying\nWhen this creature transforms into Skyclave Invader, look at the top card of your library. If it's a land card, you may put it onto the battlefield. If you don't put the card onto the battlefield, put it into your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", SKYCLAVE_AERIALIST_SKYCLAVE_INVADER.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");
const VOCAB_L3 = vocabularyEffects("Look at the top card of your library. If it's a land card, you may put it onto the battlefield. If you don't put the card onto the battlefield, put it into your hand.", SKYCLAVE_AERIALIST_SKYCLAVE_INVADER.name);
const VOCAB_T_L3 = vocabularyTargets("Look at the top card of your library. If it's a land card, you may put it onto the battlefield. If you don't put the card onto the battlefield, put it into your hand.");

export const SKYCLAVE_AERIALIST_SKYCLAVE_INVADER_SCRIPT: CardScript = {
  oracleId: SKYCLAVE_AERIALIST_SKYCLAVE_INVADER.oracleId,
  name: SKYCLAVE_AERIALIST_SKYCLAVE_INVADER.name,
  activated: [
    {
      ref: `${SKYCLAVE_AERIALIST_SKYCLAVE_INVADER.oracleId}#a0`, face: 0,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'transformsInto-3', face: 1,
      text: LINES[3] as string,
      event: 'FaceIndexSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'FaceIndexSet' && ev.card === self,
      label: () => "Skyclave Aerialist // Skyclave Invader - Look at the top card of your library. If it's a land card, you may put it onto the battlefield. If you don't put the card onto the battlefield, put it into your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
