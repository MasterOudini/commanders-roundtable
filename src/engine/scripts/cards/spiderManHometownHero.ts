// `Spider-Man, Hometown Hero` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIDER_MAN_HOMETOWN_HERO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIDER_MAN_HOMETOWN_HERO, "Reach (This creature can block creatures with flying.)\nWhen Spider-Man enters, target creature with power 2 or less can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature with power 2 or less can't be blocked this turn.", SPIDER_MAN_HOMETOWN_HERO.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature with power 2 or less can't be blocked this turn.");

export const SPIDER_MAN_HOMETOWN_HERO_SCRIPT: CardScript = {
  oracleId: SPIDER_MAN_HOMETOWN_HERO.oracleId,
  name: SPIDER_MAN_HOMETOWN_HERO.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Spider-Man, Hometown Hero - Target creature with power 2 or less can't be blocked this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
