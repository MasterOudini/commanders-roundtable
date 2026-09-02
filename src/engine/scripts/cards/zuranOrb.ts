// `Zuran Orb` — "Sacrifice a land: You gain 2 life." A {0} artifact whose only
// cost is the sacrifice chooser (D168) with NO mana at all — Viscera Seer's
// shape (D266) one noun over, paying life instead of a scry. D271.

import { ZURAN_ORB } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ZURAN_ORB, 'Sacrifice a land: You gain 2 life.');

export const ZURAN_ORB_SCRIPT: CardScript = {
  oracleId: ZURAN_ORB.oracleId,
  name: ZURAN_ORB.name,
  activated: [
    {
      ref: `${ZURAN_ORB.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
