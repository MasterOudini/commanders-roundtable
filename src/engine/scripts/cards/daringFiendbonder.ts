// `Daring Fiendbonder` - a static mustAttack, an activation counterOnTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DARING_FIENDBONDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARING_FIENDBONDER, "Haste\nThis creature attacks each combat if able.\n{1}{B}, Exile this card from your graveyard: Put an indestructible counter on target creature. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

export const DARING_FIENDBONDER_SCRIPT: CardScript = {
  oracleId: DARING_FIENDBONDER.oracleId,
  name: DARING_FIENDBONDER.name,
  activated: [
    {
      ref: `${DARING_FIENDBONDER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "indestructible", delta: 1 }] }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
