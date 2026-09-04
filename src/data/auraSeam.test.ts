// D304 - THE AURA SEAM, the classifier and accounting half: an Enchant line whose
// spec the engine enforces is the engine's own (never a player's, never an
// unread clause), and the enchanted-creature shapes an Aura row can emit.

import { describe, expect, test } from 'vitest';
import { CURSE_OF_SHALLOW_GRAVES, UNHOLY_STRENGTH } from './fixtures/engineCards';
import { enchantSpecRuns, engineCompleteness } from './engineComplete';
import { auraLineShape, primitiveFor } from './primitives';
import { parseEnchant } from './targetParse';

const runs = (line: string): boolean => {
  const spec = parseEnchant(line);
  return spec !== null && enchantSpecRuns(spec);
};

describe('the Aura seam (D304)', () => {
  test('an enforced Enchant spec is the engine own; a player, or a clause nothing read, is not', () => {
    expect(runs('Enchant creature')).toBe(true);
    expect(runs('Enchant creature you control')).toBe(true);
    expect(runs('Enchant land')).toBe(true);
    expect(runs('Enchant player')).toBe(false);
    expect(runs('Enchant creature that was dealt damage this turn')).toBe(false);
  });

  test('the accounting no longer holds the Enchant line against an Aura; a player-enchanting one it still does', () => {
    expect(engineCompleteness(UNHOLY_STRENGTH).leftover).not.toContain('Enchant creature');
    expect(engineCompleteness(CURSE_OF_SHALLOW_GRAVES).leftover).toContain('Enchant player');
  });

  test('the classifier files an enforced Enchant line as scriptable and a player one as keyword:aura', () => {
    expect(primitiveFor({ text: 'Enchant creature', kind: 'keyword' }, 'X')).toBe('scriptable');
    expect(primitiveFor({ text: 'Enchant creature you control', kind: 'keyword' }, 'X')).toBe('scriptable');
    expect(primitiveFor({ text: 'Enchant player', kind: 'keyword' }, 'X')).toBe('keyword:aura');
  });

  test('the enchanted-creature shapes a row can emit', () => {
    expect(auraLineShape('Enchanted creature gets +2/+1.')).toBe(true);
    expect(auraLineShape('Enchanted creature gets -1/-1.')).toBe(true);
    expect(auraLineShape('Enchanted creature gets +2/+0 and has trample.')).toBe(true);
    expect(auraLineShape('Enchanted creature has flying.')).toBe(true);
    expect(auraLineShape('Enchanted creature has first strike and lifelink.')).toBe(true);
    expect(auraLineShape("Enchanted creature can't attack or block.")).toBe(true);
    expect(auraLineShape("Enchanted creature can't block.")).toBe(true);
    expect(auraLineShape('Enchanted creature gets +1/+1 for each Elf you control.')).toBe(false);
    expect(auraLineShape('Enchanted creature has "{T}: Add {G}."')).toBe(false);
    expect(auraLineShape('Enchanted land has flying.')).toBe(false);
    expect(auraLineShape('You control enchanted creature.')).toBe(false);
    expect(auraLineShape("Enchanted creature doesn't untap during its controller's untap step.")).toBe(false);
  });
});
