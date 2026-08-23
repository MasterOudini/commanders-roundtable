// `Veil of Assimilation` — the self-INCLUSIVE artifact entry watcher, paying
// a targeted pump AND a vigilance grant on D194's carrier.
//
// ⚠️ TWO defs for one printed line, because a token enters via `TokenCreated`
// and a card via `CardsMoved`, and the bus dispatches on exact event kind
// (Soul Warden's rule, D158). "this artifact OR ANOTHER" means the Veil's own
// entry pays too, so the CardsMoved arm has no is-it-me exclusion. D265.

import { VEIL_OF_ASSIMILATION } from '../../../data/fixtures/engineCards';
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
  VEIL_OF_ASSIMILATION,
  'Whenever this artifact or another artifact you control enters, target creature you control gets +1/+1 and gains vigilance until end of turn.',
);

const SPECS = parseTargetClauses(TEXT);

export const VEIL_OF_ASSIMILATION_SCRIPT: CardScript = {
  oracleId: VEIL_OF_ASSIMILATION.oracleId,
  name: VEIL_OF_ASSIMILATION.name,
  triggers: [
    {
      abilityId: 'artifact-card-enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: SPECS,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
          if (m.to.player !== mine) return false;
          return ctx.derive(m.card).typeLine.types.includes('Artifact');
        });
      },
      label: () => 'Veil of Assimilation — +1/+1 and vigilance',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 1,
            toughness: 1,
            keywords: ['vigilance'],
          },
        ];
      },
    },
    {
      abilityId: 'artifact-token-enters',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: SPECS,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'TokenCreated') return false;
        if (ev.controller !== ctx.query.controllerOf(self)) return false;
        return ctx.derive(ev.card).typeLine.types.includes('Artifact');
      },
      label: () => 'Veil of Assimilation — +1/+1 and vigilance',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 1,
            toughness: 1,
            keywords: ['vigilance'],
          },
        ];
      },
    },
  ],
};
