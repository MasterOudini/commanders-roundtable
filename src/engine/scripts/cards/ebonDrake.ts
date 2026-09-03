// `Ebon Drake` - "Whenever a player casts a spell, you lose 1 life." - ANY player's
// spell (`SpellCast` is one event per spell, so one trigger per spell). Flying
// is the engine's. Whole after D295's "you lose N life" sentence reading.

import { EBON_DRAKE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EBON_DRAKE, 'Flying\nWhenever a player casts a spell, you lose 1 life.');
const TEXT = PRINTED.split('\n')[1] as string;

export const EBON_DRAKE_SCRIPT: CardScript = {
  oracleId: EBON_DRAKE.oracleId,
  name: EBON_DRAKE.name,
  triggers: [
    {
      abilityId: 'any-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'SpellCast',
      label: () => 'Ebon Drake - lose 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
};
