// `Ambush Gigapede` — "Flash\nWhen this creature enters, target creature an
// opponent controls gets -2/-2 until end of turn." Affa Guard Hound's mirror:
// the negative pump, whose lethality flows through layer 7c and the
// state-based action with no help from this def. M6.4c, D160.

import { AMBUSH_GIGAPEDE } from '../../../data/fixtures/engineCards';
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
  AMBUSH_GIGAPEDE,
  'Flash\nWhen this creature enters, target creature an opponent controls gets -2/-2 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const AMBUSH_GIGAPEDE_SCRIPT: CardScript = {
  oracleId: AMBUSH_GIGAPEDE.oracleId,
  name: AMBUSH_GIGAPEDE.name,
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
      label: () => 'Ambush Gigapede — target creature gets -2/-2 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: -2 }];
      },
    },
  ],
};
