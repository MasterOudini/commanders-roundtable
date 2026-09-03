// `Roc Charger` — Flying is the engine's. Whenever it attacks, a ground
// creature that is ATTACKING gains flying until end of turn: the combat-role
// restriction is the parser's and the validator's (D291), the keyword one
// D289's, the grant the temporary keyword carrier's.

import { ROC_CHARGER } from '../../../data/fixtures/engineCards';
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
  ROC_CHARGER,
  'Flying\nWhenever this creature attacks, target attacking creature without flying gains flying until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const ROC_CHARGER_SCRIPT: CardScript = {
  oracleId: ROC_CHARGER.oracleId,
  name: ROC_CHARGER.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Roc Charger — target attacking creature without flying gains flying until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['flying'] }];
      },
    },
  ],
};
