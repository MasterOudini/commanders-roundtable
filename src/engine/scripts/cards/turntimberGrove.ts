// `Turntimber Grove` — the targeted ETB pump on a LAND behind a tapped entry
// (Looming Spires' shape, D222). Three printed lines and this def claims the
// middle one: the tapped entry is D134's built-in, the mana line the
// engine's. D263.

import { TURNTIMBER_GROVE } from '../../../data/fixtures/engineCards';
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
  TURNTIMBER_GROVE,
  'This land enters tapped.\nWhen this land enters, target creature gets +1/+1 until end of turn.\n{T}: Add {G}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TURNTIMBER_GROVE_SCRIPT: CardScript = {
  oracleId: TURNTIMBER_GROVE.oracleId,
  name: TURNTIMBER_GROVE.name,
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
      label: () => 'Turntimber Grove — target creature gets +1/+1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
  ],
};
