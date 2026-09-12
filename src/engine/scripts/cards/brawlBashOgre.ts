// `Brawl-Bash Ogre` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRAWL_BASH_OGRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRAWL_BASH_OGRE, "Menace (This creature can't be blocked except by two or more creatures.)\nWhenever this creature attacks, you may sacrifice another creature. If you do, this creature gets +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may sacrifice another creature. If you do, this creature gets +2/+2 until end of turn.", BRAWL_BASH_OGRE.name);
const VOCAB_T_L1 = vocabularyTargets("You may sacrifice another creature. If you do, this creature gets +2/+2 until end of turn.");

export const BRAWL_BASH_OGRE_SCRIPT: CardScript = {
  oracleId: BRAWL_BASH_OGRE.oracleId,
  name: BRAWL_BASH_OGRE.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Brawl-Bash Ogre - You may sacrifice another creature. If you do, this creature gets +2/+2 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
