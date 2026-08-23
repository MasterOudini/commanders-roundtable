// `Tremor` — 1 damage to each creature WITHOUT flying: Needle Storm's fan
// (D228) with the filter inverted. One simultaneous damage event, and the
// SBA does the killing. D262.

import { TREMOR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(TREMOR, 'Tremor deals 1 damage to each creature without flying.');

export const TREMOR_SCRIPT: CardScript = {
  oracleId: TREMOR.oracleId,
  name: TREMOR.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self): readonly EventBody[] => {
      const damages: {
        source: InstanceId;
        target: { kind: 'card'; id: InstanceId };
        amount: number;
        deathtouch: boolean;
        lifelinkTo: null;
        isCommanderDamage: boolean;
        viaTrample: number;
        toxic: number;
        applyAs: 'normal';
      }[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('flying')) continue;
        damages.push({
          source: self,
          target: { kind: 'card', id },
          amount: 1,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal',
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
