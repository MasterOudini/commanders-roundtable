// `Idyllic Grange` — Plains-subtype land: "This land enters tapped unless
// you control three or more other Plains" is D135's `otherLandsOfType`
// query, the parenthesised mana line is the engine's, and the def owes
// line 2 — "When this land enters UNTAPPED, put a +1/+1 counter on target
// creature you control": Dwarven Mine's after-state filter with D147's
// targeted-trigger machinery asking for the aim. M6.4x, D180.

import { IDYLLIC_GRANGE } from '../../../data/fixtures/engineCards';
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
  IDYLLIC_GRANGE,
  '({T}: Add {W}.)\nThis land enters tapped unless you control three or more other Plains.\n' +
    'When this land enters untapped, put a +1/+1 counter on target creature you control.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const IDYLLIC_GRANGE_SCRIPT: CardScript = {
  oracleId: IDYLLIC_GRANGE.oracleId,
  name: IDYLLIC_GRANGE.name,
  triggers: [
    {
      abilityId: 'etb-untapped',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ctx.state.cards[self]?.tapped === false &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Idyllic Grange — put a +1/+1 counter on target creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
