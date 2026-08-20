// `Kami of the Waning Moon` — Flying (Tier 2) plus the Spirit-or-Arcane
// cast watcher granting FEAR. D221.

import { KAMI_OF_THE_WANING_MOON } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import { faceOf } from '../../oracle';
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
  KAMI_OF_THE_WANING_MOON,
  "Flying\nWhenever you cast a Spirit or Arcane spell, target creature gains fear until end of turn. (It can't be blocked except by artifact creatures and/or black creatures.)",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const KAMI_OF_THE_WANING_MOON_SCRIPT: CardScript = {
  oracleId: KAMI_OF_THE_WANING_MOON.oracleId,
  name: KAMI_OF_THE_WANING_MOON.name,
  triggers: [
    {
      abilityId: 'cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        const subtypes = faceOf(oc, ev.obj.faceIndex).typeLine.subtypes;
        return subtypes.includes('Spirit') || subtypes.includes('Arcane');
      },
      label: () => 'Kami of the Waning Moon — grant fear',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['fear'],
          },
        ];
      },
    },
  ],
};
