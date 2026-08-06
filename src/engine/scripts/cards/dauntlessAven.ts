// `Dauntless Aven` — "Flying\nWhenever this creature attacks, untap target
// creature you control." Cat-Owl's self-attack shape with the UNTAP mirror
// of Auriok's guard: an already-untapped target gets no event. M6.4m, D170.

import { DAUNTLESS_AVEN } from '../../../data/fixtures/engineCards';
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
  DAUNTLESS_AVEN,
  'Flying\nWhenever this creature attacks, untap target creature you control.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DAUNTLESS_AVEN_SCRIPT: CardScript = {
  oracleId: DAUNTLESS_AVEN.oracleId,
  name: DAUNTLESS_AVEN.name,
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
      label: () => 'Dauntless Aven — untap target creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || !card.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [target.id] }];
      },
    },
  ],
};
