// `Ashnod, Flesh Mechanist` - a attacks trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ASHNOD_FLESH_MECHANIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ASHNOD_FLESH_MECHANIST, "Deathtouch\nWhenever Ashnod attacks, you may sacrifice another creature. If you do, create a tapped Powerstone token.\n{5}, Exile a creature card from your graveyard: Create a tapped 3/3 colorless Zombie artifact creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may sacrifice another creature. If you do, create a tapped Powerstone token.", ASHNOD_FLESH_MECHANIST.name);
const VOCAB_T_L1 = vocabularyTargets("You may sacrifice another creature. If you do, create a tapped Powerstone token.");
const VOCAB_A0 = vocabularyEffects("Create a tapped 3/3 colorless Zombie artifact creature token.", ASHNOD_FLESH_MECHANIST.name);
const VOCAB_T_A0 = vocabularyTargets("Create a tapped 3/3 colorless Zombie artifact creature token.");

export const ASHNOD_FLESH_MECHANIST_SCRIPT: CardScript = {
  oracleId: ASHNOD_FLESH_MECHANIST.oracleId,
  name: ASHNOD_FLESH_MECHANIST.name,
  activated: [
    {
      ref: `${ASHNOD_FLESH_MECHANIST.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Ashnod, Flesh Mechanist - You may sacrifice another creature. If you do, create a tapped Powerstone token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
