// `Spider-Man, Web-Spinner` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIDER_MAN_WEB_SPINNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIDER_MAN_WEB_SPINNER, "Double strike (This creature deals both first-strike and regular combat damage.)\nHaste (This creature can attack and {T} as soon as he comes under your control.)\nWhenever Spider-Man attacks, target creature can't block this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target creature can't block this turn.", SPIDER_MAN_WEB_SPINNER.name);
const VOCAB_T_L2 = vocabularyTargets("Target creature can't block this turn.");

export const SPIDER_MAN_WEB_SPINNER_SCRIPT: CardScript = {
  oracleId: SPIDER_MAN_WEB_SPINNER.oracleId,
  name: SPIDER_MAN_WEB_SPINNER.name,
  triggers: [
    {
      abilityId: 'attacks-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Spider-Man, Web-Spinner - Target creature can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
