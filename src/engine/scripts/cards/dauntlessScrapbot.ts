// `Dauntless Scrapbot` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DAUNTLESS_SCRAPBOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DAUNTLESS_SCRAPBOT, "When this creature enters, exile each opponent's graveyard. Create a Lander token. (It's an artifact with \"{2}, {T}, Sacrifice this token: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\")");

const VOCAB_L0 = vocabularyEffects("Exile each opponent's graveyard. Create a Lander token.", DAUNTLESS_SCRAPBOT.name);
const VOCAB_T_L0 = vocabularyTargets("Exile each opponent's graveyard. Create a Lander token.");

export const DAUNTLESS_SCRAPBOT_SCRIPT: CardScript = {
  oracleId: DAUNTLESS_SCRAPBOT.oracleId,
  name: DAUNTLESS_SCRAPBOT.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Dauntless Scrapbot - Exile each opponent's graveyard. Create a Lander token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
