// `Appa, Aang's Companion` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APPA_AANG_S_COMPANION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APPA_AANG_S_COMPANION, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhenever Appa attacks, another target attacking creature without flying gains flying until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Another target attacking creature without flying gains flying until end of turn.", APPA_AANG_S_COMPANION.name);
const VOCAB_T_L1 = vocabularyTargets("Another target attacking creature without flying gains flying until end of turn.");

export const APPA_AANGS_COMPANION_SCRIPT: CardScript = {
  oracleId: APPA_AANG_S_COMPANION.oracleId,
  name: APPA_AANG_S_COMPANION.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Appa, Aang's Companion - Another target attacking creature without flying gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
