// `Eidolon of Inspiration` — "At the beginning of combat on your turn,
// target creature you control gets +2/+0 until end of turn." The FIRST
// beginning-of-combat targeted trigger (D173): Celestial Force's `StepBegan`
// with the step one notch later, the "on your turn" filter on the ACTIVE
// player, and D147's targeted-trigger machinery asking for the aim. M6.4q,
// D173.

import { EIDOLON_OF_INSPIRATION } from '../../../data/fixtures/engineCards';
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
  EIDOLON_OF_INSPIRATION,
  'At the beginning of combat on your turn, target creature you control gets +2/+0 until end of turn.',
);

export const EIDOLON_OF_INSPIRATION_SCRIPT: CardScript = {
  oracleId: EIDOLON_OF_INSPIRATION.oracleId,
  name: EIDOLON_OF_INSPIRATION.name,
  triggers: [
    {
      abilityId: 'begin-combat',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'beginCombat' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Eidolon of Inspiration — target creature you control gets +2/+0',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0 }];
      },
    },
  ],
};
