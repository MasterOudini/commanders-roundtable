// `Eyeblight Assassin` — "When this creature enters, target creature an
// opponent controls gets -1/-1 until end of turn." Blister Beetle's debuff
// with the opponent restriction on the aim. M6.4r, D174.

import { EYEBLIGHT_ASSASSIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  EYEBLIGHT_ASSASSIN,
  'When this creature enters, target creature an opponent controls gets -1/-1 until end of turn.',
);

export const EYEBLIGHT_ASSASSIN_SCRIPT: CardScript = {
  oracleId: EYEBLIGHT_ASSASSIN.oracleId,
  name: EYEBLIGHT_ASSASSIN.name,
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
      label: () => 'Eyeblight Assassin — target creature gets -1/-1 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
      },
    },
  ],
};
