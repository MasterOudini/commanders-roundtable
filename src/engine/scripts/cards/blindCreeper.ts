// `Blind Creeper` - a aPlayerCastsSpell trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLIND_CREEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLIND_CREEPER, "Whenever a player casts a spell, this creature gets -1/-1 until end of turn.");

export const BLIND_CREEPER_SCRIPT: CardScript = {
  oracleId: BLIND_CREEPER.oracleId,
  name: BLIND_CREEPER.name,
  triggers: [
    {
      abilityId: 'aPlayerCastsSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'SpellCast',
      label: () => "Blind Creeper - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: -1, toughness: -1 }];
      },
    },
  ],
};
