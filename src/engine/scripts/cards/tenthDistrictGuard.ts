// `Tenth District Guard` — the targeted ETB pump at +0/+1: toughness only,
// which is the half Swift Kick's own test proved matters (D255 — a +1/+0
// leaves toughness alone and the creature still trades). D258.

import { TENTH_DISTRICT_GUARD } from '../../../data/fixtures/engineCards';
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
  TENTH_DISTRICT_GUARD,
  'When this creature enters, target creature gets +0/+1 until end of turn.',
);

export const TENTH_DISTRICT_GUARD_SCRIPT: CardScript = {
  oracleId: TENTH_DISTRICT_GUARD.oracleId,
  name: TENTH_DISTRICT_GUARD.name,
  triggers: [
    {
      abilityId: 'etb-pump',
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
      label: () => 'Tenth District Guard — target creature gets +0/+1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 1 }];
      },
    },
  ],
};
