// `Goblin Assault Team` — "When this creature dies, put a +1/+1 counter on
// target creature you control." The dies shape with a CONTROLLER-restricted
// target through D147's machinery; line 1 is Haste (Tier 2). M6.4u, D177.

import { GOBLIN_ASSAULT_TEAM } from '../../../data/fixtures/engineCards';
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
  GOBLIN_ASSAULT_TEAM,
  'Haste\nWhen this creature dies, put a +1/+1 counter on target creature you control.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const GOBLIN_ASSAULT_TEAM_SCRIPT: CardScript = {
  oracleId: GOBLIN_ASSAULT_TEAM.oracleId,
  name: GOBLIN_ASSAULT_TEAM.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Goblin Assault Team — +1/+1 counter on target creature you control',
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
