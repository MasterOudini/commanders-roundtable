// `The Wasp, Winsome Avenger` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THE_WASP_WINSOME_AVENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THE_WASP_WINSOME_AVENGER, "Flash\nFlying\nWhen The Wasp enters, target Hero gains hexproof until end of turn.\nWhenever The Wasp attacks, tap target creature defending player controls.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target Hero gains hexproof until end of turn.", THE_WASP_WINSOME_AVENGER.name);
const VOCAB_T_L2 = vocabularyTargets("Target Hero gains hexproof until end of turn.");
const VOCAB_L3 = vocabularyEffects("Tap target creature defending player controls.", THE_WASP_WINSOME_AVENGER.name);
const VOCAB_T_L3 = vocabularyTargets("Tap target creature defending player controls.");

export const THE_WASP_WINSOME_AVENGER_SCRIPT: CardScript = {
  oracleId: THE_WASP_WINSOME_AVENGER.oracleId,
  name: THE_WASP_WINSOME_AVENGER.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "The Wasp, Winsome Avenger - Target Hero gains hexproof until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'attacks-3',
      text: LINES[3] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L3,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "The Wasp, Winsome Avenger - Tap target creature defending player controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
