// `Death-Hood Cobra` - a one-shot pump on itself / itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { DEATH_HOOD_COBRA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEATH_HOOD_COBRA, "{1}{G}: This creature gains reach until end of turn.\n{1}{G}: This creature gains deathtouch until end of turn.");
const LINES = PRINTED.split('\n');

export const DEATH_HOOD_COBRA_SCRIPT: CardScript = {
  oracleId: DEATH_HOOD_COBRA.oracleId,
  name: DEATH_HOOD_COBRA.name,
  activated: [
    {
      ref: `${DEATH_HOOD_COBRA.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["reach"] }];
      },
    },
    {
      ref: `${DEATH_HOOD_COBRA.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["deathtouch"] }];
      },
    },
  ],
};
