// `Hardbristle Bandit` - a youCommitCrime trigger untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARDBRISTLE_BANDIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HARDBRISTLE_BANDIT, "{T}: Add one mana of any color.\nWhenever you commit a crime, untap this creature. This ability triggers only once each turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)");
const LINES = PRINTED.split('\n');

export const HARDBRISTLE_BANDIT_SCRIPT: CardScript = {
  oracleId: HARDBRISTLE_BANDIT.oracleId,
  name: HARDBRISTLE_BANDIT.name,
  triggers: [
    {
      abilityId: 'youCommitCrime-1',
      text: LINES[1] as string,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Hardbristle Bandit - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
