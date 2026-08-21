// `Shambling Goblin` — "When this creature dies, target creature an
// opponent controls gets -1/-1 until end of turn." The dies-debuff with
// the opponent restriction ENFORCED (Rimefur's probed clause). D246.

import { SHAMBLING_GOBLIN } from '../../../data/fixtures/engineCards';
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
  SHAMBLING_GOBLIN,
  'When this creature dies, target creature an opponent controls gets -1/-1 until end of turn.',
);

export const SHAMBLING_GOBLIN_SCRIPT: CardScript = {
  oracleId: SHAMBLING_GOBLIN.oracleId,
  name: SHAMBLING_GOBLIN.name,
  triggers: [
    {
      abilityId: 'dies-debuff',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Shambling Goblin — target creature gets -1/-1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
      },
    },
  ],
};
