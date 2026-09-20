// `Spider-Man, Miles Morales` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIDER_MAN_MILES_MORALES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIDER_MAN_MILES_MORALES, "Vigilance, trample (Attacking doesn't cause this creature to tap. He can deal excess combat damage to the player he's attacking.)\nWhenever Spider-Man enters or attacks, put a +1/+1 counter on each other creature you control. Those creatures gain trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on each other creature you control. Those creatures gain trample until end of turn.", SPIDER_MAN_MILES_MORALES.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on each other creature you control. Those creatures gain trample until end of turn.");

export const SPIDER_MAN_MILES_MORALES_SCRIPT: CardScript = {
  oracleId: SPIDER_MAN_MILES_MORALES.oracleId,
  name: SPIDER_MAN_MILES_MORALES.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Spider-Man, Miles Morales - Put a +1/+1 counter on each other creature you control. Those creatures gain trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Spider-Man, Miles Morales - Put a +1/+1 counter on each other creature you control. Those creatures gain trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
