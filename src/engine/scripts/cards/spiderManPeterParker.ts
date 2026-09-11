// `Spider-Man, Peter Parker` - a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIDER_MAN_PETER_PARKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIDER_MAN_PETER_PARKER, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhenever you gain life, put a +1/+1 counter on target creature you control. It gains indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on target creature you control. It gains indestructible until end of turn.", SPIDER_MAN_PETER_PARKER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on target creature you control. It gains indestructible until end of turn.");

export const SPIDER_MAN_PETER_PARKER_SCRIPT: CardScript = {
  oracleId: SPIDER_MAN_PETER_PARKER.oracleId,
  name: SPIDER_MAN_PETER_PARKER.name,
  triggers: [
    {
      abilityId: 'youGainLife-1',
      text: LINES[1] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Spider-Man, Peter Parker - Put a +1/+1 counter on target creature you control. It gains indestructible until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
