// `Virtuous Variant` — flying plus the targeted ETB +1/+1 counter, with the
// "you control" restriction enforced at the aim (PROBED). The keyword line
// never counts, so the def's text is `split[1]`. D266.

import { VIRTUOUS_VARIANT } from '../../../data/fixtures/engineCards';
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
  VIRTUOUS_VARIANT,
  "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhen this creature enters, put a +1/+1 counter on target creature you control.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const VIRTUOUS_VARIANT_SCRIPT: CardScript = {
  oracleId: VIRTUOUS_VARIANT.oracleId,
  name: VIRTUOUS_VARIANT.name,
  triggers: [
    {
      abilityId: 'etb-counter',
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
      label: () => 'Virtuous Variant — put a +1/+1 counter on target creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }];
      },
    },
  ],
};
