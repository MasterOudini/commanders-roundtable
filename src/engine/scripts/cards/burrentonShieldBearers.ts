// `Burrenton Shield-Bearers` — "Whenever this creature attacks, target
// creature gets +0/+3 until end of turn." The first SELF-attack trigger:
// Armasaur Guide's event with an is-it-me filter, targeting through D147's
// machinery. M6.4i, D166.

import { BURRENTON_SHIELD_BEARERS } from '../../../data/fixtures/engineCards';
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
  BURRENTON_SHIELD_BEARERS,
  'Whenever this creature attacks, target creature gets +0/+3 until end of turn.',
);

export const BURRENTON_SHIELD_BEARERS_SCRIPT: CardScript = {
  oracleId: BURRENTON_SHIELD_BEARERS.oracleId,
  name: BURRENTON_SHIELD_BEARERS.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Burrenton Shield-Bearers — target creature gets +0/+3 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 3 }];
      },
    },
  ],
};
