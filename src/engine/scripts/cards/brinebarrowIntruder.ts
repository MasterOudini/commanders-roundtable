// `Brinebarrow Intruder` — "Flash\nWhen this creature enters, target
// creature an opponent controls gets -2/-0 until end of turn." A targeted
// ETB debuff with the opponent-controls restriction enforced by targeting.
// M6.4i, D166.

import { BRINEBARROW_INTRUDER } from '../../../data/fixtures/engineCards';
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
  BRINEBARROW_INTRUDER,
  'Flash\nWhen this creature enters, target creature an opponent controls gets -2/-0 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const BRINEBARROW_INTRUDER_SCRIPT: CardScript = {
  oracleId: BRINEBARROW_INTRUDER.oracleId,
  name: BRINEBARROW_INTRUDER.name,
  triggers: [
    {
      abilityId: 'etb',
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
      label: () => 'Brinebarrow Intruder — target creature an opponent controls gets -2/-0',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: 0 }];
      },
    },
  ],
};
