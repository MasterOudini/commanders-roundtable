// `Pierce Strider` — "When this creature enters, target opponent loses
// 3 life." Peace Strider's dark twin: targeted, and a loss. D233.

import { PIERCE_STRIDER } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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

const TEXT = printed(PIERCE_STRIDER, 'When this creature enters, target opponent loses 3 life.');

export const PIERCE_STRIDER_SCRIPT: CardScript = {
  oracleId: PIERCE_STRIDER.oracleId,
  name: PIERCE_STRIDER.name,
  triggers: [
    {
      abilityId: 'etb-drain',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Pierce Strider — target opponent loses 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const player = ctx.state.players[target.id];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -3, to: player.life - 3 }];
      },
    },
  ],
};
