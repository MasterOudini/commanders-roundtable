// `Rot Farm Mortipede` - a cardLeavesYourGraveyard trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROT_FARM_MORTIPEDE } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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

const PRINTED = printed(ROT_FARM_MORTIPEDE, "Whenever one or more creature cards leave your graveyard, this creature gets +1/+0 and gains menace and lifelink until end of turn.");

export const ROT_FARM_MORTIPEDE_SCRIPT: CardScript = {
  oracleId: ROT_FARM_MORTIPEDE.oracleId,
  name: ROT_FARM_MORTIPEDE.name,
  triggers: [
    {
      abilityId: 'cardLeavesYourGraveyard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'graveyard') return false;
          if (m.from.player !== ctx.query.controllerOf(self)) return false;
          const inst = ctx.state.cards[m.card];
          const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
          if (!oc) return false;
          const f = faceOf(oc, inst?.faceIndex ?? 0);
          return f.typeLine.types.includes('Creature');
        }),
      label: () => "Rot Farm Mortipede - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["menace", "lifelink"] }];
      },
    },
  ],
};
