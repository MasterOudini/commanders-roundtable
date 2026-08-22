// `Territorial Hammerskull` — the SELF-attack trigger that taps (Burrenton
// Shield-Bearers' filter, D166, with Chrome Prowler's tap payload, D167). The
// opponent restriction on the target is ENFORCED at the aim (D236's Public
// Execution), so the def does not re-check it. D258.

import { TERRITORIAL_HAMMERSKULL } from '../../../data/fixtures/engineCards';
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
  TERRITORIAL_HAMMERSKULL,
  'Whenever this creature attacks, tap target creature an opponent controls.',
);

export const TERRITORIAL_HAMMERSKULL_SCRIPT: CardScript = {
  oracleId: TERRITORIAL_HAMMERSKULL.oracleId,
  name: TERRITORIAL_HAMMERSKULL.name,
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
      label: () => 'Territorial Hammerskull — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
