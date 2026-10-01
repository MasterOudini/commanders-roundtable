// `Hightide Hermit` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HIGHTIDE_HERMIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HIGHTIDE_HERMIT, "Defender\nWhen this creature enters, you get {E}{E}{E}{E} (four energy counters).\nPay {E}{E}: This creature can attack this turn as though it didn't have defender.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You get {E}{E}{E}{E}.", HIGHTIDE_HERMIT.name);
const VOCAB_T_L1 = vocabularyTargets("You get {E}{E}{E}{E}.");
const VOCAB_A0 = vocabularyEffects("~ can attack this turn as though it didn't have defender.", HIGHTIDE_HERMIT.name);
const VOCAB_T_A0 = vocabularyTargets("~ can attack this turn as though it didn't have defender.");

export const HIGHTIDE_HERMIT_SCRIPT: CardScript = {
  oracleId: HIGHTIDE_HERMIT.oracleId,
  name: HIGHTIDE_HERMIT.name,
  activated: [
    {
      ref: `${HIGHTIDE_HERMIT.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Hightide Hermit - You get {E}{E}{E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
