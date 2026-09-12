// `Swarm Culler` - a becomesTapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SWARM_CULLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SWARM_CULLER, "Flying\nWhenever this creature becomes tapped, you may sacrifice another creature or artifact. If you do, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may sacrifice another creature or artifact. If you do, draw a card.", SWARM_CULLER.name);
const VOCAB_T_L1 = vocabularyTargets("You may sacrifice another creature or artifact. If you do, draw a card.");

export const SWARM_CULLER_SCRIPT: CardScript = {
  oracleId: SWARM_CULLER.oracleId,
  name: SWARM_CULLER.name,
  triggers: [
    {
      abilityId: 'becomesTapped-1',
      text: LINES[1] as string,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Swarm Culler - You may sacrifice another creature or artifact. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
