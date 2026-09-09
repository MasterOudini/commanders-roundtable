// `Altac Bloodseeker` - a aCreatureDies trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALTAC_BLOODSEEKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALTAC_BLOODSEEKER, "Whenever a creature an opponent controls dies, this creature gets +2/+0 and gains first strike and haste until end of turn. (It deals combat damage before creatures without first strike, and it can attack and {T} as soon as it comes under your control.)");

export const ALTAC_BLOODSEEKER_SCRIPT: CardScript = {
  oracleId: ALTAC_BLOODSEEKER.oracleId,
  name: ALTAC_BLOODSEEKER.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Altac Bloodseeker - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0, keywords: ["firstStrike", "haste"] }];
      },
    },
  ],
};
