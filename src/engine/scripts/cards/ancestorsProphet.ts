// `Ancestor's Prophet` — tapping five untapped Clerics I control (the D286
// tap chooser, a plural subtype read back to "Cleric"; the Prophet is one)
// gains me 10 life.

import { ANCESTOR_S_PROPHET } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ANCESTOR_S_PROPHET, 'Tap five untapped Clerics you control: You gain 10 life.');

export const ANCESTORS_PROPHET_SCRIPT: CardScript = {
  oracleId: ANCESTOR_S_PROPHET.oracleId,
  name: ANCESTOR_S_PROPHET.name,
  activated: [
    {
      ref: `${ANCESTOR_S_PROPHET.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 10, to: me.life + 10 }];
      },
    },
  ],
};
