// `Senate Guildmage` - an activation gainLife, an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SENATE_GUILDMAGE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SENATE_GUILDMAGE, "{W}, {T}: You gain 2 life.\n{U}, {T}: Draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

export const SENATE_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: SENATE_GUILDMAGE.oracleId,
  name: SENATE_GUILDMAGE.name,
  activated: [
    {
      ref: `${SENATE_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
    {
      ref: `${SENATE_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Senate Guildmage - discard a card" } },
        ];
      },
    },
  ],
};
