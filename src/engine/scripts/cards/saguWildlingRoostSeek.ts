// `Sagu Wildling // Roost Seek` - a etb trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAGU_WILDLING_ROOST_SEEK } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(SAGU_WILDLING_ROOST_SEEK, "Flying\nWhen this creature enters, you gain 3 life.\nSearch your library for a basic land card, reveal it, put it into your hand, then shuffle. (Also shuffle this card.)");
const LINES = PRINTED.split('\n');

export const SAGU_WILDLING_ROOST_SEEK_SCRIPT: CardScript = {
  oracleId: SAGU_WILDLING_ROOST_SEEK.oracleId,
  name: SAGU_WILDLING_ROOST_SEEK.name,
  triggers: [
    {
      abilityId: 'etb-1', face: 0,
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sagu Wildling // Roost Seek - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
};
