// `Frostweb Spider` - a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FROSTWEB_SPIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FROSTWEB_SPIDER, "Reach (This creature can block creatures with flying.)\nWhenever this creature blocks a creature with flying, put a +1/+1 counter on this creature at end of combat.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on ~ at end of combat.", FROSTWEB_SPIDER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on ~ at end of combat.");

export const FROSTWEB_SPIDER_SCRIPT: CardScript = {
  oracleId: FROSTWEB_SPIDER.oracleId,
  name: FROSTWEB_SPIDER.name,
  triggers: [
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' &&
        ev.blocks.some((b) => b.blocker === self && ctx.derive(b.attacker).typeLine.types.includes('Creature') && ctx.derive(b.attacker).keywords.has('flying')),
      label: () => "Frostweb Spider - Put a +1/+1 counter on ~ at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
