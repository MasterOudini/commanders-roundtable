// `Supply Drop` — Flash is the engine's; the entry aims +2/+2 at a creature
// of mine; four mana, the tap and the Drop itself buy a card.

import { SUPPLY_DROP } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(
  SUPPLY_DROP,
  'Flash\nWhen this artifact enters, target creature you control gets +2/+2 until end of turn.\n{4}, {T}, Sacrifice this artifact: Draw a card.',
);
const ENTERS = PRINTED.split('\n')[1] as string;
const DRAW = PRINTED.split('\n')[2] as string;

export const SUPPLY_DROP_SCRIPT: CardScript = {
  oracleId: SUPPLY_DROP.oracleId,
  name: SUPPLY_DROP.name,
  triggers: [
    {
      abilityId: 'enters-pump',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTERS),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Supply Drop — +2/+2 to a creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: [] }];
      },
    },
  ],
  activated: [
    {
      ref: `${SUPPLY_DROP.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
