// `Long Feng, Grand Secretariat` — "Whenever another creature you control
// or a land you control is put into a graveyard from the battlefield, put a
// +1/+1 counter on target creature you control." The controlled dies
// watcher over TWO type arms ("another" binds to the creature arm; a land
// needs no exclusion — Long Feng is not a land), asking for an aim.
// M6.4ac, D185.

import { LONG_FENG_GRAND_SECRETARIAT } from '../../../data/fixtures/engineCards';
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
  LONG_FENG_GRAND_SECRETARIAT,
  'Whenever another creature you control or a land you control is put into a graveyard from the battlefield, put a +1/+1 counter on target creature you control.',
);

export const LONG_FENG_GRAND_SECRETARIAT_SCRIPT: CardScript = {
  oracleId: LONG_FENG_GRAND_SECRETARIAT.oracleId,
  name: LONG_FENG_GRAND_SECRETARIAT.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          const types = ctx.derive(m.card).typeLine.types;
          if (types.includes('Land')) return true;
          return m.card !== self && types.includes('Creature');
        }),
      label: () => 'Long Feng — put a +1/+1 counter on target creature you control',
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
