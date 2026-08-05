// `Acolyte of Xathrid` — "{1}{B}, {T}: Target player loses 1 life." The first
// PLAYER-targeted ActivatedDef (M6.4c, D160). Loss of life is not damage
// (CR 119.3), so the event is a bare LifeChanged, never a ResolvedDamage.

import { ACOLYTE_OF_XATHRID } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ACOLYTE_OF_XATHRID, '{1}{B}, {T}: Target player loses 1 life.');

export const ACOLYTE_OF_XATHRID_SCRIPT: CardScript = {
  oracleId: ACOLYTE_OF_XATHRID.oracleId,
  name: ACOLYTE_OF_XATHRID.name,
  activated: [
    {
      ref: `${ACOLYTE_OF_XATHRID.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const player = ctx.state.players[target.id];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -1, to: player.life - 1 }];
      },
    },
  ],
};
