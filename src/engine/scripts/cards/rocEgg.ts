// `Roc Egg` — "Defender / When this creature dies, create a 3/3 white
// Bird creature token with flying." Jewel-Eyed Cobra's dies-token
// behind a keyword-and-reminder line. D241.

import { ROC_EGG } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(
  ROC_EGG,
  "Defender (This creature can't attack.)\nWhen this creature dies, create a 3/3 white Bird creature token with flying.",
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const BIRD = tokenRef('Bird|3/3|W|Creature|flying');

export const ROC_EGG_SCRIPT: CardScript = {
  oracleId: ROC_EGG.oracleId,
  name: ROC_EGG.name,
  triggers: [
    {
      abilityId: 'dies-bird',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Roc Egg — create a 3/3 Bird with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BIRD.oracleId,
          printingId: BIRD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
