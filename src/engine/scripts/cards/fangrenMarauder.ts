// `Fangren Marauder` - a cardPutIntoGraveyard trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FANGREN_MARAUDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FANGREN_MARAUDER, "Whenever an artifact is put into a graveyard from the battlefield, you may gain 5 life.");

export const FANGREN_MARAUDER_SCRIPT: CardScript = {
  oracleId: FANGREN_MARAUDER.oracleId,
  name: FANGREN_MARAUDER.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Fangren Marauder - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 5, to: me.life + 5 }];
      },
    },
  ],
};
