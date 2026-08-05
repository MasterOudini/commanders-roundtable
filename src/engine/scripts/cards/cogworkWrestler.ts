// `Cogwork Wrestler` — "Flash\nWhen this creature enters, target creature an
// opponent controls gets -2/-0 until end of turn." Brinebarrow Intruder's
// shape. M6.4j, D167.

import { COGWORK_WRESTLER } from '../../../data/fixtures/engineCards';
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
  COGWORK_WRESTLER,
  'Flash\nWhen this creature enters, target creature an opponent controls gets -2/-0 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const COGWORK_WRESTLER_SCRIPT: CardScript = {
  oracleId: COGWORK_WRESTLER.oracleId,
  name: COGWORK_WRESTLER.name,
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
      label: () => 'Cogwork Wrestler — target creature an opponent controls gets -2/-0',
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
