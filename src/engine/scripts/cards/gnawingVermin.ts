// `Gnawing Vermin` - a etb trigger vocab, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GNAWING_VERMIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GNAWING_VERMIN, "When this creature enters, target player mills two cards.\nWhen this creature dies, target creature you don't control gets -1/-1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target player mills two cards.", GNAWING_VERMIN.name);
const VOCAB_T_L0 = vocabularyTargets("Target player mills two cards.");
const VOCAB_L1 = vocabularyEffects("Target creature you don't control gets -1/-1 until end of turn.", GNAWING_VERMIN.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature you don't control gets -1/-1 until end of turn.");

export const GNAWING_VERMIN_SCRIPT: CardScript = {
  oracleId: GNAWING_VERMIN.oracleId,
  name: GNAWING_VERMIN.name,
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
      label: () => "Gnawing Vermin - Target player mills two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Gnawing Vermin - Target creature you don't control gets -1/-1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
