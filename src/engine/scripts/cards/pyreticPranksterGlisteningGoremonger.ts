// `Pyretic Prankster // Glistening Goremonger` - an activation vocab, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PYRETIC_PRANKSTER_GLISTENING_GOREMONGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PYRETIC_PRANKSTER_GLISTENING_GOREMONGER, "{3}{B/P}: Transform this creature. Activate only as a sorcery. ({B/P} can be paid with either {B} or 2 life.)\nWhen this creature dies, each opponent sacrifices an artifact or creature of their choice.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", PYRETIC_PRANKSTER_GLISTENING_GOREMONGER.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");
const VOCAB_L1 = vocabularyEffects("Each opponent sacrifices an artifact or creature of their choice.", PYRETIC_PRANKSTER_GLISTENING_GOREMONGER.name);
const VOCAB_T_L1 = vocabularyTargets("Each opponent sacrifices an artifact or creature of their choice.");

export const PYRETIC_PRANKSTER_GLISTENING_GOREMONGER_SCRIPT: CardScript = {
  oracleId: PYRETIC_PRANKSTER_GLISTENING_GOREMONGER.oracleId,
  name: PYRETIC_PRANKSTER_GLISTENING_GOREMONGER.name,
  activated: [
    {
      ref: `${PYRETIC_PRANKSTER_GLISTENING_GOREMONGER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'dies-1', face: 1,
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Pyretic Prankster // Glistening Goremonger - Each opponent sacrifices an artifact or creature of their choice.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
