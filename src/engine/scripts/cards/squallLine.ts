// `Squall Line` — "Squall Line deals X damage to each creature with flying
// and each player." The first X-costed SpellDef: X rides the stack object
// (`obj.xValue`, the hasX cast stage), the flyers are DERIVED (a granted
// flying dies to it, a removed one survives), and EACH player includes the
// caster — hurricanes do not discriminate. The spell is the source, so no
// riders (a spell has no derived keywords — Char's rule). D192.

import { SQUALL_LINE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SQUALL_LINE, 'Squall Line deals X damage to each creature with flying and each player.');

export const SQUALL_LINE_SCRIPT: CardScript = {
  oracleId: SQUALL_LINE.oracleId,
  name: SQUALL_LINE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature') || !d.keywords.has('flying')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: x,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      for (const [pid, p] of Object.entries(ctx.state.players)) {
        if (p.hasLost) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: pid },
          amount: x,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
