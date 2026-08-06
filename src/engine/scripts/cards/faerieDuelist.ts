// `Faerie Duelist` — "Flash\nFlying\nWhen this creature enters, target
// creature an opponent controls gets -2/-0 until end of turn." Two Tier-2
// keyword lines, then Eyeblight Assassin's shape at -2/-0. M6.4r, D174.

import { FAERIE_DUELIST } from '../../../data/fixtures/engineCards';
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
  FAERIE_DUELIST,
  'Flash\nFlying\nWhen this creature enters, target creature an opponent controls gets -2/-0 until end of turn.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const FAERIE_DUELIST_SCRIPT: CardScript = {
  oracleId: FAERIE_DUELIST.oracleId,
  name: FAERIE_DUELIST.name,
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
      label: () => 'Faerie Duelist — target creature gets -2/-0 until end of turn',
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
