import type { Resources, TerrainToolType, ToolCategory, ZoneOverlayType } from '../../game/types';
import { CompiledSprite } from './pixelEngine';
import {
  PixelCanvas,
  RAMPS,
  RGB,
  hash2d,
  lerpRgb,
  paintSprite,
  quantRamp,
} from './pixelPainter';

/** Shared helper for isometric 3/4 biome plinths used across Terrain & Building icons */
function drawIsoEarthBase(
  c: PixelCanvas,
  cx: number,
  botY: number,
  rx: number,
  ry: number,
  h: number,
  topRamp = RAMPS.leaf,
  soilLeft = RAMPS.wood,
  soilRight = RAMPS.darkWood,
  topPattern?: (x: number, y: number, u: number, v: number) => RGB | null,
) {
  c.fillIsoBox(cx, botY, rx, ry, h, topRamp, soilLeft, soilRight, topPattern);
}

export const TITLE_EMBLEM_SPRITE: CompiledSprite = paintSprite((c) => {
  // 3/4 Sandstone stepped Ziggurat + floating celestial sun orb
  drawIsoEarthBase(c, 16, 29, 13, 6, 4, RAMPS.sandstone, RAMPS.sandstone, RAMPS.darkWood);
  drawIsoEarthBase(c, 16, 24, 10, 4.5, 4, RAMPS.sandstone, RAMPS.sandstone, RAMPS.darkWood);
  drawIsoEarthBase(c, 16, 19, 6.5, 3, 4, RAMPS.gold, RAMPS.sandstone, RAMPS.darkWood);
  // Central staircase slit
  c.fillPoly(
    [
      [14, 28],
      [18, 28],
      [17, 19],
      [15, 19],
    ],
    (x, y, _nx, _ny, _nz, _l, _u, v) =>
      quantRamp(RAMPS.darkWood, (y % 2 === 0 ? 0.55 : 0.25) - v * 0.1, x, y, 0.02),
  );
  // Floating glowing cyan sky orb above altar
  c.fillEllipse(16, 9, 4.2, 4.2, 0, (x, y, nx, ny, nz, light) => {
    if (nx < -0.35 && ny < -0.35 && nz > 0.55) return RAMPS.azure.hi;
    return quantRamp(RAMPS.azure, light * 1.15, x, y, 0.03);
  });
  // Golden sun ring tips & sparkles
  c.sparkle(16, 2, RAMPS.gold.hi, true);
  c.sparkle(7, 7, RAMPS.gold.light, false);
  c.sparkle(25, 7, RAMPS.gold.light, false);
  c.sparkle(14, 7, RAMPS.ice.hi, false);
});

export const RESOURCE_SPRITES: Record<keyof Resources, CompiledSprite> = {
  // Plump tilted ruby apple with crisp oak leaf, stem & glossy speculars
  food: paintSprite((c) => {
    // Stem
    c.fillBezier(16, 10, 17, 6, 19, 4, 1.3, 0.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkWood, light, x, y, 0.02),
    );
    // Veined green leaf curving right
    c.fillPoly(
      [
        [17, 8],
        [23, 5],
        [27, 7],
        [24, 11],
        [19, 10],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const vein = Math.abs(v - 0.45) < 0.09 ? 0.16 : 0;
        return quantRamp(RAMPS.leaf, light * 0.9 + vein - u * 0.1, x, y, 0.03);
      },
    );
    // Left & right plump apple lobes (subtle tilt + crease)
    c.fillEllipse(13.5, 18.5, 8.2, 9.2, -0.18, (x, y, nx, ny, nz, light) => {
      if (nx < -0.25 && ny < -0.35 && nz > 0.65) return RAMPS.crimson.hi;
      const bounce = ny > 0.65 && nx > 0.2 ? 0.14 : 0;
      return quantRamp(RAMPS.crimson, light * 0.95 + bounce, x, y, 0.035);
    });
    c.fillEllipse(19.2, 18.8, 7.6, 8.8, 0.14, (x, y, nx, ny, nz, light) => {
      const bounce = ny > 0.6 && nx > 0.3 ? 0.16 : 0;
      return quantRamp(RAMPS.crimson, light * 0.88 + bounce, x, y, 0.035);
    });
    // Crisp specular shine cluster on top-left shoulder
    c.put(10, 14, RAMPS.crimson.hi);
    c.put(11, 13, [255, 252, 244]);
    c.put(12, 13, [255, 252, 244]);
    c.put(10, 15, [255, 240, 224]);
    // Stem dimple shadow
    c.put(16, 11, RAMPS.crimson.deep);
    c.put(17, 11, RAMPS.crimson.deep);
  }),

  // Tilted twin cut oak logs with rough bark grooves, knot & concentric growth rings
  wood: paintSprite((c) => {
    // Back upper log angled diagonally
    c.fillCapsule(10, 14, 24, 8, 5.2, 4.8, (x, y, _nx, _ny, _nz, light, u, v) => {
      const bark = hash2d(Math.floor(x / 2), y, 5) * 0.14 + Math.sin(v * 14) * 0.08;
      return quantRamp(RAMPS.darkWood, light * 0.9 + bark - u * 0.05, x, y, 0.02);
    });
    // Front foreground log
    c.fillCapsule(8, 22, 24, 15, 5.6, 5.2, (x, y, _nx, _ny, _nz, light, u, v) => {
      const bark = Math.sin(v * 15 + u * 3) * 0.09 + hash2d(x, Math.floor(y / 2), 9) * 0.08;
      return quantRamp(RAMPS.wood, light * 0.95 + bark, x, y, 0.02);
    });
    // Growth-ring cut ends facing bottom-left
    const drawRings = (cx: number, cy: number, rx: number, ry: number) => {
      c.fillEllipse(cx, cy, rx, ry, -0.35, (x, y, nx, ny) => {
        const rad = Math.sqrt(nx * nx + ny * ny);
        const ring = Math.sin(rad * 15) > 0.35 ? -0.18 : 0.08;
        return quantRamp(RAMPS.parchment, 0.72 + ring - rad * 0.18, x, y, 0.02);
      });
    };
    drawRings(10, 14, 3.6, 4.6);
    drawRings(8, 22, 4.2, 5.0);
    // Tiny moss sprout on log crevice
    c.put(17, 14, RAMPS.leaf.light);
    c.put(18, 14, RAMPS.leaf.mid);
    c.put(18, 13, RAMPS.leaf.hi);
  }),

  // Chiseled 3/4 granite & slate boulder cluster with bright quartz facets & moss
  stone: paintSprite((c) => {
    c.fillPoly(
      [
        [9, 10],
        [17, 4],
        [25, 10],
        [26, 22],
        [8, 22],
      ],
      (x, y, _nx, _ny, _nz, _l, u, v) => {
        const plane = u < 0.45 ? 0.88 - v * 0.2 : 0.56 - v * 0.25;
        const crack = Math.abs(u - 0.52 + v * 0.15) < 0.04 ? -0.25 : 0;
        return quantRamp(RAMPS.stone, plane + crack + hash2d(x, y, 31) * 0.06, x, y, 0.02);
      },
    );
    c.fillPoly(
      [
        [4, 17],
        [10, 12],
        [17, 15],
        [18, 26],
        [6, 27],
        [4, 22],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const rim = u < 0.35 && v < 0.45 ? 0.18 : 0;
        return quantRamp(RAMPS.stone, light * 1.05 + rim - v * 0.18, x, y, 0.02);
      },
    );
    c.fillPoly(
      [
        [17, 17],
        [24, 14],
        [29, 20],
        [27, 26],
        [18, 27],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) =>
        quantRamp(RAMPS.stone, light * 0.78 - u * 0.14 - v * 0.1, x, y, 0.02),
    );
    c.put(12, 13, RAMPS.leaf.light);
    c.put(13, 13, RAMPS.leaf.mid);
    c.put(13, 14, RAMPS.leaf.dark);
    c.put(16, 6, RAMPS.stone.hi);
    c.put(9, 14, RAMPS.stone.hi);
  }),

  // Dark ironstone matrix studded with protruding gleaming gold crystals
  ore: paintSprite((c) => {
    c.fillPoly(
      [
        [5, 16],
        [10, 10],
        [21, 9],
        [27, 16],
        [26, 25],
        [15, 28],
        [6, 25],
      ],
      (x, y, _nx, _ny, _nz, light, _u, v) => {
        const sp = hash2d(x, y, 42) * 0.1;
        return quantRamp(RAMPS.darkIron, light * 0.85 + sp - v * 0.15, x, y, 0.03);
      },
    );
    // Three protruding faceted gold crystal prisms
    const drawPrism = (pts: ReadonlyArray<readonly [number, number]>, bias: number) => {
      c.fillPoly(pts, (x, y, _nx, _ny, _nz, light, u, v) => {
        const facet = u < 0.45 ? 0.16 : -0.12;
        return quantRamp(RAMPS.gold, light + bias + facet - v * 0.12, x, y, 0.02);
      });
    };
    drawPrism(
      [
        [12, 5],
        [16, 4],
        [18, 14],
        [13, 16],
        [10, 12],
      ],
      0.08,
    );
    drawPrism(
      [
        [19, 10],
        [25, 8],
        [26, 17],
        [20, 19],
      ],
      0.0,
    );
    drawPrism(
      [
        [8, 15],
        [14, 15],
        [16, 23],
        [9, 24],
      ],
      0.04,
    );
    c.sparkle(14, 6, RAMPS.gold.hi, false);
    c.sparkle(23, 10, RAMPS.gold.hi, true);
  }),

  // Tilted brass-clasped arcane grimoire with glowing cyan rune & ribbon
  knowledge: paintSprite((c) => {
    // Crimson ribbon tail protruding bottom
    c.fillPoly(
      [
        [18, 22],
        [22, 23],
        [22, 29],
        [20, 27],
        [18, 29],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.crimson, light, x, y, 0.02),
    );
    // Thick ivory page block bottom-right
    c.fillPoly(
      [
        [7, 21],
        [21, 26],
        [26, 20],
        [12, 15],
      ],
      (x, y, _nx, _ny, _nz, _l, _u, v) => {
        const line = Math.floor(v * 8) % 2 === 0 ? 0.08 : -0.1;
        return quantRamp(RAMPS.parchment, 0.68 + line, x, y, 0.02);
      },
    );
    // Rich indigo-violet leather cover in 3/4 angle
    c.fillPoly(
      [
        [5, 14],
        [16, 5],
        [27, 11],
        [16, 22],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const spine = u < 0.18 ? -0.15 : 0.05;
        return quantRamp(RAMPS.arcane, light * 0.92 + spine - v * 0.08, x, y, 0.03);
      },
    );
    // Brass corner brackets + center glowing cyan rune diamond
    c.fillPoly(
      [
        [16, 10],
        [19, 13],
        [16, 16],
        [13, 13],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.azure, light * 1.18, x, y, 0.02),
    );
    c.put(16, 12, RAMPS.azure.hi);
    c.put(16, 6, RAMPS.gold.light);
    c.put(25, 11, RAMPS.gold.mid);
    c.put(16, 21, RAMPS.gold.mid);
  }),

  // Tilted glass Tesla capacitor phial crackling with cyan plasma arc
  energy: paintSprite((c) => {
    // Tilted glass body
    c.fillCapsule(9, 23, 23, 9, 5.2, 5.2, (x, y, nx, ny, nz, light, u, v) => {
      const bolt = Math.abs(v - 0.5 + Math.sin(u * 16) * 0.16) < 0.12;
      if (bolt) return quantRamp(RAMPS.azure, 0.95, x, y, 0.01);
      if (nx < -0.3 && ny < -0.3 && nz > 0.4) return RAMPS.glass.hi;
      return quantRamp(RAMPS.azure, light * 0.72, x, y, 0.03);
    });
    // Brass end caps at top-right and bottom-left
    c.fillEllipse(23, 9, 4.6, 2.8, 0.78, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.05, x, y, 0.02),
    );
    c.fillEllipse(9, 23, 4.6, 2.8, 0.78, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 0.9, x, y, 0.02),
    );
    c.sparkle(16, 15, [255, 255, 240], false);
    c.sparkle(25, 5, RAMPS.gold.hi, true);
    c.sparkle(7, 12, RAMPS.azure.hi, false);
  }),

  // 3/4 Isometric forged teal-silver alloy ingot bar with sunken seal & chrome gleam
  alloy: paintSprite((c) => {
    // Bottom beveled trapezoidal ingot
    drawIsoEarthBase(c, 16, 25, 11.5, 5.8, 6.5, RAMPS.azure, RAMPS.steel, RAMPS.darkIron);
    // Beveled inner recessed stamp rectangle on top face
    c.fillPoly(
      [
        [16, 10],
        [22, 13],
        [16, 16],
        [10, 13],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.steel, light * 0.75, x, y, 0.02),
    );
    // Gleaming specular ridge
    c.fillCapsule(10, 15, 16, 18, 0.7, 0.7, () => RAMPS.steel.hi);
    c.sparkle(12, 11, RAMPS.steel.hi, false);
    c.sparkle(22, 12, RAMPS.azure.hi, false);
  }),

  // Celestial 8-point golden sunburst medallion with luminous opal pearl core
  faith: paintSprite((c) => {
    const drawRay = (x1: number, y1: number, x2: number, y2: number, r1: number) =>
      c.fillCapsule(x1, y1, x2, y2, r1, 0.5, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.gold, light * 1.05, x, y, 0.02),
      );
    drawRay(16, 16, 16, 3, 2.6);
    drawRay(16, 16, 16, 29, 2.6);
    drawRay(16, 16, 3, 16, 2.6);
    drawRay(16, 16, 29, 16, 2.6);
    drawRay(16, 16, 7, 7, 1.8);
    drawRay(16, 16, 25, 7, 1.8);
    drawRay(16, 16, 7, 25, 1.8);
    drawRay(16, 16, 25, 25, 1.8);
    // Central radiant opal-azure jewel
    c.fillEllipse(16, 16, 5.2, 5.2, 0, (x, y, nx, ny, nz, light) => {
      if (nx < -0.3 && ny < -0.3 && nz > 0.55) return RAMPS.gold.hi;
      return quantRamp(RAMPS.azure, light * 1.15, x, y, 0.02);
    });
    c.sparkle(9, 4, RAMPS.gold.hi, false);
    c.sparkle(25, 24, RAMPS.gold.hi, false);
  }),
};

export const TAB_SPRITES: Record<ToolCategory, CompiledSprite> = {
  // 45° celestial golden scepter topped with crackling star crystal
  powers: paintSprite((c) => {
    c.fillCapsule(6, 26, 21, 11, 1.6, 1.9, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    // Golden pommel & head prongs
    c.fillEllipse(6, 26, 2.4, 2.4, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light, x, y, 0.02),
    );
    c.fillEllipse(22, 10, 5.4, 5.4, 0, (x, y, nx, ny, nz, light) => {
      if (nx < -0.3 && ny < -0.3 && nz > 0.5) return RAMPS.azure.hi;
      return quantRamp(RAMPS.azure, light * 1.12, x, y, 0.03);
    });
    c.sparkle(23, 5, RAMPS.gold.hi, true);
    c.sparkle(13, 8, RAMPS.gold.hi, false);
    c.sparkle(27, 16, RAMPS.azure.hi, false);
  }),

  // Floating 3/4 isometric grass & mountain island chunk over ocean foam
  terrain: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 26, 12, 5.5, 5, RAMPS.leaf, RAMPS.wood, RAMPS.darkWood);
    // Sculpted mountain cone rising from top diamond
    c.fillPoly(
      [
        [9, 17],
        [16, 6],
        [24, 17],
        [16, 20],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        if (v < 0.32) return quantRamp(RAMPS.cloud, light * 1.1, x, y, 0.02);
        return quantRamp(u < 0.5 ? RAMPS.stone : RAMPS.darkIron, light, x, y, 0.03);
      },
    );
    // Frothy surf highlight along front edge
    c.fillCapsule(8, 25, 16, 28, 0.9, 0.9, () => RAMPS.azure.light);
    c.fillCapsule(16, 28, 24, 25, 0.9, 0.9, () => RAMPS.azure.mid);
  }),

  // 45° forged iron claw hammer with oiled oak handle
  build: paintSprite((c) => {
    // Oak handle
    c.fillCapsule(6, 26, 21, 11, 2.0, 2.2, (x, y, _nx, _ny, _nz, light, u) => {
      const grain = Math.sin(u * 18) * 0.08;
      return quantRamp(RAMPS.wood, light + grain, x, y, 0.02);
    });
    // Angled iron hammer head
    c.fillPoly(
      [
        [12, 8],
        [17, 4],
        [26, 13],
        [22, 17],
      ],
      (x, y, _nx, _ny, _nz, light, _u, v) =>
        quantRamp(RAMPS.steel, light + (v < 0.35 ? 0.14 : -0.1), x, y, 0.02),
    );
    // Curved claw tips at top-left
    c.fillBezier(14, 7, 10, 5, 8, 9, 1.5, 0.7, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 0.92, x, y, 0.02),
    );
    c.put(18, 6, RAMPS.steel.hi);
  }),

  // Adventurer portrait bust in cerulean tunic & golden buckle
  spawn: paintSprite((c) => {
    // Shoulders & tunic
    c.fillEllipse(16, 24, 9.5, 6.5, 0, (x, y, _nx, _ny, _nz, light, u) => {
      if (Math.abs(u - 0.5) < 0.08) return RAMPS.gold.light;
      return quantRamp(RAMPS.azure, light, x, y, 0.03);
    });
    // Neck & warm head
    c.fillEllipse(16, 13.5, 6.6, 6.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.skin, light, x, y, 0.02),
    );
    // Swept chestnut hair cap
    c.fillPoly(
      [
        [9, 13],
        [10, 6],
        [17, 5],
        [23, 8],
        [23, 13],
        [19, 10],
        [13, 10],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    // Eyes + rosy cheeks
    c.put(13, 14, [24, 18, 16]);
    c.put(13, 13, RAMPS.steel.hi);
    c.put(19, 14, [24, 18, 16]);
    c.put(19, 13, RAMPS.steel.hi);
    c.put(11, 16, RAMPS.pink.mid);
    c.put(21, 16, RAMPS.pink.mid);
  }),

  // Shaded world globe with green continents, polar snow & brass meridian
  zones: paintSprite((c) => {
    // Brass meridian pedestal
    c.fillCapsule(16, 25, 16, 29, 2, 4.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light, x, y, 0.02),
    );
    c.fillEllipse(16, 14.5, 10.5, 10.5, 0, (x, y, nx, ny, nz, light) => {
      if (ny < -0.62) return quantRamp(RAMPS.cloud, light * 1.1, x, y, 0.02);
      const continent = Math.sin(nx * 4.2 + ny * 2.1) + Math.cos(ny * 3.8 - nx * 1.5) > 0.35;
      if (continent) return quantRamp(RAMPS.leaf, light * 1.04, x, y, 0.03);
      if (nx < -0.35 && ny < -0.2 && nz > 0.6) return RAMPS.azure.hi;
      return quantRamp(RAMPS.azure, light * 0.95, x, y, 0.03);
    });
  }),

  // Angled royal parchment scroll with mahogany rollers & crimson wax seal
  rules: paintSprite((c) => {
    c.fillPoly(
      [
        [8, 6],
        [24, 5],
        [25, 24],
        [7, 25],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const ink =
          v > 0.2 && v < 0.72 && u > 0.22 && u < 0.75 && Math.floor(y) % 3 === 0
            ? -0.32
            : 0;
        return quantRamp(RAMPS.parchment, light + ink, x, y, 0.02);
      },
    );
    // Top & bottom curled rollers
    c.fillCapsule(6, 6, 25, 6, 2.2, 2.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    c.fillCapsule(6, 25, 25, 25, 2.2, 2.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light * 0.9, x, y, 0.02),
    );
    // Crimson wax seal at bottom-right
    c.fillEllipse(21, 20, 3.3, 3.3, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.crimson, light * 1.05, x, y, 0.02),
    );
    c.put(20, 19, RAMPS.crimson.hi);
  }),

  // Ornate brass-pillared hourglass pouring golden sand
  epochs: paintSprite((c) => {
    // Upper & lower glass bulbs
    c.fillPoly(
      [
        [9, 7],
        [23, 7],
        [17, 16],
        [15, 16],
      ],
      (x, y, _nx, _ny, _nz, light, _u, v) =>
        quantRamp(v > 0.45 ? RAMPS.gold : RAMPS.glass, light, x, y, 0.02),
    );
    c.fillPoly(
      [
        [15, 16],
        [17, 16],
        [23, 25],
        [9, 25],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const pile = v > 0.55 && Math.abs(u - 0.5) < (v - 0.4) * 1.1;
        return quantRamp(pile ? RAMPS.gold : RAMPS.glass, light, x, y, 0.02);
      },
    );
    // Brass pillars & endplates
    c.fillCapsule(8, 6, 24, 6, 1.8, 1.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light, x, y, 0.02),
    );
    c.fillCapsule(8, 26, 24, 26, 1.8, 1.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 0.9, x, y, 0.02),
    );
    c.fillCapsule(8, 7, 8, 25, 1.0, 1.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkWood, light, x, y, 0.02),
    );
    c.fillCapsule(24, 7, 24, 25, 1.0, 1.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkWood, light * 0.85, x, y, 0.02),
    );
  }),

  // 45° brass-rimmed magnifying glass with sky-blue glass glare
  inspect: paintSprite((c) => {
    // Mahogany handle
    c.fillCapsule(18, 18, 27, 27, 2.2, 2.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    // Brass rim ring
    c.fillEllipse(13, 13, 9.2, 9.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light, x, y, 0.02),
    );
    // Convex sapphire glass interior
    c.fillEllipse(13, 13, 6.8, 6.8, 0, (x, y, nx, ny, nz, light) => {
      if (nx < -0.25 && ny < -0.25 && nz > 0.65) return RAMPS.glass.hi;
      return quantRamp(RAMPS.glass, light * 1.05, x, y, 0.02);
    });
    c.put(9, 10, [255, 255, 255]);
    c.put(10, 9, [255, 255, 255]);
  }),
};

export const ZONE_SPRITES: Record<ZoneOverlayType, CompiledSprite> = {
  // Heraldic parchment kingdom banner scroll topped with royal gold crown emblem
  kingdomLabels: paintSprite((c) => {
    c.fillPoly(
      [
        [5, 8],
        [27, 8],
        [27, 22],
        [16, 27],
        [5, 22],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const edge = u < 0.14 || u > 0.86 || v < 0.14;
        return quantRamp(edge ? RAMPS.gold : RAMPS.parchment, light * 1.02, x, y, 0.02);
      },
    );
    // Crisp dark ink banner lines + ruby crest dot
    c.fillCapsule(9, 15, 23, 15, 0.9, 0.9, () => RAMPS.darkWood.dark);
    c.fillCapsule(11, 19, 21, 19, 0.8, 0.8, () => RAMPS.darkWood.mid);
    c.fillEllipse(16, 11, 2.2, 1.8, 0, () => RAMPS.crimson.light);
    c.fillCapsule(4, 7, 28, 7, 1.5, 1.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.08, x, y, 0.02),
    );
  }),

  // 3/4 fortified stone citadel flying ruby pennants
  kingdoms: paintSprite((c) => {
    // Central gatehouse block
    drawIsoEarthBase(c, 16, 27, 10, 4.5, 10, RAMPS.stone, RAMPS.stone, RAMPS.darkIron);
    // Left & right cylindrical corner turrets
    c.fillCapsule(8, 24, 8, 11, 3.6, 3.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light, x, y, 0.02),
    );
    c.fillCapsule(24, 24, 24, 11, 3.6, 3.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light * 0.85, x, y, 0.02),
    );
    // Conical terracotta turret caps & ruby pennants
    c.fillPoly(
      [
        [4, 12],
        [8, 6],
        [12, 12],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.terracotta, light, x, y, 0.02),
    );
    c.fillPoly(
      [
        [20, 12],
        [24, 6],
        [28, 12],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.terracotta, light * 0.88, x, y, 0.02),
    );
    c.fillPoly(
      [
        [8, 4],
        [14, 5],
        [8, 7],
      ],
      () => RAMPS.crimson.light,
    );
    c.fillPoly(
      [
        [24, 4],
        [29, 5],
        [24, 7],
      ],
      () => RAMPS.crimson.mid,
    );
    // Dark oak portcullis arch
    c.fillEllipse(16, 24, 2.6, 3.8, 0, () => RAMPS.darkWood.deep);
  }),

  // Jeweled 5-point royal gold crown with velvet cushion & faceted gems
  kings: paintSprite((c) => {
    // Crimson velvet cap inside
    c.fillEllipse(16, 15, 8.5, 5.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.crimson, light, x, y, 0.03),
    );
    // 5 golden prongs
    const spikes: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
      [
        [5, 20],
        [4, 9],
        [10, 16],
      ],
      [
        [9, 17],
        [10, 6],
        [15, 16],
      ],
      [
        [13, 17],
        [16, 4],
        [19, 17],
      ],
      [
        [17, 16],
        [22, 6],
        [23, 17],
      ],
      [
        [22, 16],
        [28, 9],
        [27, 20],
      ],
    ];
    for (const s of spikes) {
      c.fillPoly(s, (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.gold, light, x, y, 0.02));
    }
    // Curved royal band
    c.fillCapsule(6, 22, 26, 22, 3.2, 3.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 0.98, x, y, 0.02),
    );
    // Faceted center ruby + sapphire/emerald flanks
    c.fillEllipse(16, 21, 2.2, 2.2, 0, () => RAMPS.crimson.light);
    c.put(15, 20, RAMPS.crimson.hi);
    c.put(10, 21, RAMPS.azure.light);
    c.put(22, 21, RAMPS.leaf.light);
    c.sparkle(16, 4, RAMPS.gold.hi, false);
  }),

  // Carved hunter's forest shield with golden paw crest
  territories: paintSprite((c) => {
    c.fillPoly(
      [
        [6, 6],
        [16, 4],
        [26, 6],
        [25, 19],
        [16, 28],
        [7, 19],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const border = u < 0.14 || u > 0.86 || v < 0.12 || v > 0.86;
        return quantRamp(border ? RAMPS.gold : RAMPS.leaf, light, x, y, 0.025);
      },
    );
    // Golden paw pad & toes
    c.fillEllipse(16, 18, 3.5, 2.8, 0, () => RAMPS.parchment.hi);
    c.fillEllipse(11, 13, 1.4, 1.8, -0.2, () => RAMPS.parchment.hi);
    c.fillEllipse(14.5, 11, 1.4, 1.8, 0, () => RAMPS.parchment.hi);
    c.fillEllipse(17.8, 11, 1.4, 1.8, 0, () => RAMPS.parchment.hi);
    c.fillEllipse(21, 13, 1.4, 1.8, 0.2, () => RAMPS.parchment.hi);
  }),

  // Split 4-quadrant 3/4 isometric living biome cube
  biomes: paintSprite((c) => {
    drawIsoEarthBase(
      c,
      16,
      27,
      12.5,
      6.2,
      8,
      RAMPS.leaf,
      RAMPS.wood,
      RAMPS.darkWood,
      (x, y, u, v) => {
        if (u < 0.5 && v < 0.5) return quantRamp(RAMPS.cloud, 0.9, x, y, 0.02); // snow
        if (u >= 0.5 && v < 0.5) return quantRamp(RAMPS.sandstone, 0.82, x, y, 0.03); // desert
        if (u < 0.5 && v >= 0.5) return quantRamp(RAMPS.leaf, 0.84, x, y, 0.03); // forest
        return quantRamp(RAMPS.azure, 0.85, x, y, 0.02); // ocean
      },
    );
    // Tiny pine sprout on green quadrant
    c.fillPoly(
      [
        [9, 15],
        [12, 8],
        [15, 15],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.leaf, light, x, y, 0.02),
    );
  }),

  // Crossed Azure (Allied) & Crimson (War) beveled shields bound by golden crest
  alliances: paintSprite((c) => {
    // Left silver-rimmed azure kite shield
    c.fillPoly(
      [
        [3, 7],
        [14, 5],
        [15, 17],
        [9, 25],
        [4, 18],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const rim = u < 0.16 || u > 0.84 || v < 0.14 || v > 0.84;
        return quantRamp(rim ? RAMPS.steel : RAMPS.azure, light * 1.06, x, y, 0.02);
      },
    );
    // Right silver-rimmed crimson kite shield
    c.fillPoly(
      [
        [18, 5],
        [29, 7],
        [28, 18],
        [23, 25],
        [17, 17],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const rim = u < 0.16 || u > 0.84 || v < 0.14 || v > 0.84;
        return quantRamp(rim ? RAMPS.steel : RAMPS.crimson, light, x, y, 0.02);
      },
    );
    // Golden heraldic clasp knot bridging both shields
    c.fillEllipse(16, 15, 4.4, 4.4, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.12, x, y, 0.02),
    );
    c.sparkle(15, 13, RAMPS.gold.hi, false);
  }),

  // Brass-backed alchemical thermometer with icy top & fiery crimson bulb
  temperature: paintSprite((c) => {
    c.fillCapsule(16, 5, 16, 22, 4.2, 4.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.parchment, light, x, y, 0.02),
    );
    c.fillEllipse(16, 23, 6.2, 6.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.parchment, light * 0.95, x, y, 0.02),
    );
    // Upper icy tube + lower crimson mercury column
    c.fillCapsule(16, 6, 16, 13, 1.8, 1.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.ice, light * 1.1, x, y, 0.02),
    );
    c.fillCapsule(16, 13, 16, 22, 1.8, 1.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.crimson, light * 1.08, x, y, 0.02),
    );
    c.fillEllipse(16, 23, 4.2, 4.2, 0, (x, y, nx, ny, nz, light) => {
      if (nx < -0.25 && ny < -0.25 && nz > 0.6) return RAMPS.crimson.hi;
      return quantRamp(RAMPS.crimson, light * 1.05, x, y, 0.02);
    });
  }),
};

export const TERRAIN_SPRITES: Record<TerrainToolType, CompiledSprite> = {
  raise: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 5, RAMPS.leaf, RAMPS.wood, RAMPS.darkWood);
    c.fillPoly(
      [
        [8, 19],
        [16, 12],
        [24, 19],
        [16, 22],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.leaf, light * 1.08, x, y, 0.03),
    );
    // Bold golden upward uplift arrow
    c.fillPoly(
      [
        [16, 2],
        [22, 9],
        [18, 9],
        [18, 14],
        [14, 14],
        [14, 9],
        [10, 9],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.gold, light * 1.12, x, y, 0.02),
    );
  }),

  lower: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 5, RAMPS.leaf, RAMPS.wood, RAMPS.darkWood, (x, y, u, v) => {
      if (u > 0.28 && u < 0.72 && v > 0.28 && v < 0.72) {
        return quantRamp(RAMPS.darkWood, 0.35, x, y, 0.02);
      }
      return null;
    });
    // Amber downward arrow
    c.fillPoly(
      [
        [14, 3],
        [18, 3],
        [18, 10],
        [22, 10],
        [16, 17],
        [10, 10],
        [14, 10],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.flame, light * 1.05, x, y, 0.02),
    );
  }),

  flatten: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 27, 12, 5.5, 6, RAMPS.stone, RAMPS.stone, RAMPS.darkIron);
    // Golden carpenter spirit-level bar floating above flat terrace
    c.fillCapsule(6, 9, 26, 9, 2.5, 2.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light, x, y, 0.02),
    );
    c.fillCapsule(13, 9, 19, 9, 1.5, 1.5, () => RAMPS.azure.hi);
  }),

  fertile_meadow: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12.5, 5.8, 5, RAMPS.leaf, RAMPS.wood, RAMPS.darkWood);
    // Sunflower & poppy stems + colorful blooms
    c.fillCapsule(11, 18, 11, 10, 0.8, 0.8, () => RAMPS.leaf.mid);
    c.fillEllipse(11, 9, 3.2, 3.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.1, x, y, 0.02),
    );
    c.put(11, 9, RAMPS.darkWood.dark);
    c.fillCapsule(21, 19, 21, 12, 0.8, 0.8, () => RAMPS.leaf.mid);
    c.fillEllipse(21, 11, 2.8, 2.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.crimson, light * 1.1, x, y, 0.02),
    );
    c.put(21, 11, RAMPS.gold.hi);
    c.sparkle(16, 16, RAMPS.leaf.hi, false);
  }),

  plant_forest: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.leaf, RAMPS.wood, RAMPS.darkWood);
    // Tree trunks
    c.fillCapsule(12, 20, 12, 13, 1.4, 1.1, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    c.fillCapsule(21, 21, 21, 14, 1.2, 1.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkWood, light, x, y, 0.02),
    );
    // Layered bushy oak & pine crowns
    c.fillEllipse(12, 10, 5.5, 5.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.leaf, light * 1.06, x, y, 0.04),
    );
    c.fillPoly(
      [
        [16, 15],
        [21, 4],
        [26, 15],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.leaf, light * 0.95, x, y, 0.03),
    );
  }),

  seed_ore: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 5.5, RAMPS.darkIron, RAMPS.stone, RAMPS.darkIron);
    c.fillPoly(
      [
        [10, 17],
        [13, 6],
        [17, 7],
        [16, 18],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.gold, light * 1.12, x, y, 0.02),
    );
    c.fillPoly(
      [
        [17, 18],
        [22, 9],
        [25, 13],
        [21, 20],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.gold, light * 0.96, x, y, 0.02),
    );
    c.sparkle(14, 7, RAMPS.gold.hi, true);
  }),

  carve_river: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 27, 12.5, 5.8, 5, RAMPS.leaf, RAMPS.wood, RAMPS.darkWood, (x, y, u, v) => {
      const meander = Math.sin(u * 5) * 0.08;
      const d = Math.abs(v - 0.5 + meander);
      if (d < 0.16) {
        const foam = d > 0.11 && (x + y) % 3 === 0 ? 0.95 : 0.72;
        return quantRamp(RAMPS.azure, foam, x, y, 0.02);
      }
      if (d < 0.22) return RAMPS.darkWood.mid; // earthen bank lip
      return null;
    });
  }),

  stone_road: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 27, 12.5, 5.8, 5, RAMPS.stone, RAMPS.wood, RAMPS.darkWood, (x, y, u, v) => {
      const su = u * 3.4 + (Math.floor(v * 3.4) % 2) * 0.45;
      const sv = v * 3.4;
      const fu = su - Math.floor(su);
      const fv = sv - Math.floor(sv);
      const distEdge = Math.min(fu, 1 - fu, fv, 1 - fv);
      if (distEdge < 0.11) return RAMPS.darkWood.dark;
      const shade = ((Math.floor(su) * 7 + Math.floor(sv) * 13) % 3) * 0.1 + 0.68;
      return quantRamp(RAMPS.stone, shade, x, y, 0.02);
    });
  }),

  rail_track: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 27, 12.5, 5.8, 5, RAMPS.stone, RAMPS.darkWood, RAMPS.darkIron);
    // Perspective wood sleepers + gleaming steel rails
    for (let i = 0; i < 4; i++) {
      const sx = 9 + i * 3.5;
      const sy = 18 - i * 1.6;
      c.fillCapsule(sx - 3, sy - 2, sx + 3, sy + 2, 1.0, 1.0, () => RAMPS.wood.dark);
    }
    c.fillCapsule(7, 17, 21, 10, 0.8, 0.8, () => RAMPS.steel.hi);
    c.fillCapsule(11, 20, 25, 13, 0.8, 0.8, () => RAMPS.steel.light);
  }),

  // Glowing azure & amethyst crystal shards sprouting from stone pedestal
  crystal_shower: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4, RAMPS.stone, RAMPS.stone, RAMPS.darkIron);
    c.fillPoly(
      [
        [13, 19],
        [16, 3],
        [20, 19],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.azure, light * 1.15, x, y, 0.02),
    );
    c.fillPoly(
      [
        [8, 20],
        [10, 9],
        [14, 19],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.arcane, light * 1.1, x, y, 0.02),
    );
    c.fillPoly(
      [
        [19, 19],
        [23, 10],
        [24, 20],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.ice, light * 1.12, x, y, 0.02),
    );
    c.sparkle(16, 4, [255, 255, 255], true);
  }),

  // Craggy granite boulders raining onto rough mountain stone slab
  boulder_rain: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.stone, RAMPS.stone, RAMPS.darkIron);
    c.fillEllipse(15, 16, 5.2, 4.5, 0.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light * 1.02, x, y, 0.03),
    );
    c.fillEllipse(10, 9, 3.2, 2.8, -0.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light * 1.06, x, y, 0.03),
    );
    c.fillEllipse(22, 8, 2.6, 2.4, 0.3, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkIron, light * 1.05, x, y, 0.03),
    );
    c.put(11, 5, RAMPS.parchment.hi);
  }),

  // Cherry-blossom pink canopy & floating petals above verdant meadow slab
  blossom_rain: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.leaf, RAMPS.wood, RAMPS.darkWood);
    c.fillCapsule(16, 20, 16, 13, 1.5, 1.2, () => RAMPS.darkWood.mid);
    c.fillEllipse(16, 11, 7.5, 5.4, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.pink, light * 1.08, x, y, 0.03),
    );
    c.sparkle(7, 7, RAMPS.pink.hi, false);
    c.sparkle(25, 8, RAMPS.pink.light, false);
    c.sparkle(10, 18, RAMPS.pink.hi, false);
  }),

  // Lush multi-tiered jungle palm & emerald fern canopy
  jungle_bloom: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.leaf, RAMPS.darkWood, RAMPS.darkWood);
    c.fillCapsule(15, 20, 16, 10, 1.6, 1.2, () => RAMPS.wood.mid);
    for (const [tx, ty] of [
      [7, 11],
      [25, 11],
      [10, 6],
      [22, 6],
    ]) {
      c.fillBezier(16, 10, (16 + tx) * 0.5, ty - 2, tx, ty, 2.0, 0.7, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.leaf, light * 1.08, x, y, 0.025),
      );
    }
    c.fillEllipse(12, 18, 3.0, 2.0, 0, () => RAMPS.toxic.mid);
    c.put(20, 17, RAMPS.flame.hi);
  }),

  // Rich dark humus soil sprouting fresh golden-green shoots
  soil_enrich: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 5, RAMPS.darkWood, RAMPS.wood, RAMPS.darkWood);
    for (const [sx, sy] of [
      [11, 18],
      [16, 15],
      [21, 18],
    ]) {
      c.fillCapsule(sx, sy, sx, sy - 5, 0.9, 0.6, () => RAMPS.leaf.light);
      c.fillEllipse(sx - 2, sy - 5, 1.8, 1.1, -0.4, () => RAMPS.leaf.hi);
      c.fillEllipse(sx + 2, sy - 5, 1.8, 1.1, 0.4, () => RAMPS.toxic.light);
    }
  }),

  // Sun-baked desert sandstone dunes with emerald saguaro cactus
  desert_dunes: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 5, RAMPS.sandstone, RAMPS.sandstone, RAMPS.darkWood);
    c.fillCapsule(17, 18, 17, 8, 1.7, 1.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.leaf, light * 1.05, x, y, 0.02),
    );
    c.fillCapsule(13, 14, 13, 10, 1.1, 1.0, () => RAMPS.leaf.mid);
    c.fillCapsule(13, 14, 17, 14, 1.0, 1.0, () => RAMPS.leaf.mid);
    c.fillCapsule(21, 12, 21, 9, 1.1, 1.0, () => RAMPS.leaf.light);
    c.fillCapsule(17, 12, 21, 12, 1.0, 1.0, () => RAMPS.leaf.mid);
  }),

  // Shallow turquoise sea tile blooming with colorful coral reefs
  coral_reef_rain: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.azure, RAMPS.azure, RAMPS.darkIron);
    c.fillBezier(11, 19, 9, 13, 8, 9, 1.6, 0.8, () => RAMPS.pink.light);
    c.fillBezier(11, 16, 13, 12, 14, 9, 1.3, 0.7, () => RAMPS.pink.hi);
    c.fillBezier(20, 19, 22, 13, 24, 10, 1.6, 0.8, () => RAMPS.flame.light);
    c.fillEllipse(16, 18, 2.4, 1.8, 0, () => RAMPS.gold.light);
  }),

  // Sunken salvage crate & golden treasure glint on coastal sandbar
  salvage_drop: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.sandstone, RAMPS.wood, RAMPS.darkWood);
    c.fillIsoBox(16, 20, 6.2, 3.0, 5.5, RAMPS.wood, RAMPS.wood, RAMPS.darkWood);
    c.fillCapsule(11, 14, 21, 14, 1.0, 1.0, () => RAMPS.gold.light);
    c.sparkle(16, 10, RAMPS.gold.hi, true);
  }),

  // Jagged obsidian glass spikes veined with molten magma
  volcanic_obsidian: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.darkIron, RAMPS.darkIron, RAMPS.stone, (x, y, u, v) =>
      Math.abs(u - v) < 0.14 ? quantRamp(RAMPS.flame, 1.05, x, y, 0.02) : null,
    );
    c.fillPoly(
      [
        [10, 18],
        [14, 5],
        [18, 18],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.arcane, light * 0.75, x, y, 0.02),
    );
    c.fillPoly(
      [
        [17, 19],
        [22, 8],
        [24, 19],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.darkIron, light * 0.9, x, y, 0.02),
    );
  }),

  // Ancient sunlit marble & gold Atlantean temple ruins rising from sea
  atlantis_rise: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.azure, RAMPS.parchment, RAMPS.stone);
    c.fillCapsule(10, 19, 10, 9, 1.6, 1.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light, x, y, 0.02),
    );
    c.fillCapsule(22, 19, 22, 9, 1.6, 1.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 0.9, x, y, 0.02),
    );
    c.fillPoly(
      [
        [8, 9],
        [16, 4],
        [24, 9],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.gold, light * 1.1, x, y, 0.02),
    );
  }),

  // Crisp frosted alpine snow & translucent glacier crystal spire
  alpine_glacier: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.cloud, RAMPS.ice, RAMPS.azure);
    c.fillPoly(
      [
        [8, 19],
        [15, 5],
        [22, 19],
      ],
      (x, y, _nx, _ny, _nz, light, u) =>
        quantRamp(u < 0.5 ? RAMPS.cloud : RAMPS.ice, light * 1.08, x, y, 0.02),
    );
    c.sparkle(15, 5, [255, 255, 255], false);
  }),

  // Deep abyssal trench ocean block with glowing hydrothermal/bioluminescent fissure
  abyssal_trench: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 5, RAMPS.azure, RAMPS.darkIron, RAMPS.darkIron, (x, y, u, v) => {
      if (Math.hypot(u - 0.5, v - 0.5) < 0.25) return quantRamp(RAMPS.arcane, 0.25, x, y, 0.02);
      return null;
    });
    c.sparkle(16, 18, RAMPS.azure.hi, true);
    c.put(12, 16, RAMPS.toxic.hi);
  }),

  // Mossy murky swamp mire with bubbling marsh gas & cattail reeds
  swamp_mire: paintSprite((c) => {
    drawIsoEarthBase(c, 16, 28, 12, 5.5, 4.5, RAMPS.darkWood, RAMPS.darkWood, RAMPS.darkIron, (x, y, u, v) =>
      (u + v) % 0.45 < 0.22 ? quantRamp(RAMPS.toxic, 0.55, x, y, 0.02) : null,
    );
    c.fillCapsule(10, 18, 10, 9, 0.8, 0.6, () => RAMPS.leaf.mid);
    c.fillEllipse(10, 10, 1.5, 2.3, 0, () => RAMPS.darkWood.mid);
    c.fillEllipse(19, 17, 2.0, 1.4, 0, () => RAMPS.toxic.hi);
    c.put(22, 15, RAMPS.toxic.light);
  }),
};

// Sharp 32x32 HUD sprites preserving `currentColor` responsiveness (tag = 3) + golden accents
function paintHud(draw: (c: PixelCanvas) => void): CompiledSprite {
  return paintSprite(draw, { selOut: true, selOutDarkness: 0.25 });
}

const CC_COL: RGB = [232, 224, 210];
function putCC(c: PixelCanvas, x: number, y: number) {
  c.put(x, y, CC_COL, 3);
}

export const HUD_SPRITES: Record<
  | 'rotateLeft'
  | 'rotateRight'
  | 'center'
  | 'zoomIn'
  | 'zoomOut'
  | 'pan'
  | 'log'
  | 'audioOn'
  | 'audioOff'
  | 'pause'
  | 'play'
  | 'reset'
  | 'save'
  | 'camera'
  | 'speed'
  | 'chevronDown'
  | 'chevronUp'
  | 'sliders'
  | 'settings'
  | 'star'
  | 'starOn'
  | 'close',
  CompiledSprite
> = {
  rotateLeft: paintHud((c) => {
    c.fillBezier(24, 12, 23, 25, 10, 23, 2.1, 2.1, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillBezier(24, 12, 17, 5, 9, 10, 2.1, 2.1, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillPoly(
      [
        [6, 12],
        [10, 5],
        [14, 12],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.gold, light * 1.1, x, y, 0.02),
    );
  }),

  rotateRight: paintHud((c) => {
    c.fillBezier(8, 12, 9, 25, 22, 23, 2.1, 2.1, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillBezier(8, 12, 15, 5, 23, 10, 2.1, 2.1, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillPoly(
      [
        [18, 12],
        [22, 5],
        [26, 12],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.gold, light * 1.1, x, y, 0.02),
    );
  }),

  center: paintHud((c) => {
    for (const [x1, y1, x2, y2] of [
      [16, 3, 16, 9],
      [16, 23, 16, 29],
      [3, 16, 9, 16],
      [23, 16, 29, 16],
    ]) {
      c.fillCapsule(x1, y1, x2, y2, 1.5, 1.5, (x, y) => {
        putCC(c, x, y);
        return null;
      });
    }
    c.fillEllipse(16, 16, 5.2, 5.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.1, x, y, 0.02),
    );
    c.fillEllipse(16, 16, 2.2, 2.2, 0, () => RAMPS.azure.hi);
  }),

  zoomIn: paintHud((c) => {
    c.fillCapsule(19, 19, 27, 27, 2.2, 2.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    c.fillEllipse(13, 13, 8.8, 8.8, 0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillEllipse(13, 13, 6.2, 6.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.glass, light, x, y, 0.02),
    );
    c.fillCapsule(13, 9, 13, 17, 1.2, 1.2, () => RAMPS.leaf.light);
    c.fillCapsule(9, 13, 17, 13, 1.2, 1.2, () => RAMPS.leaf.light);
  }),

  zoomOut: paintHud((c) => {
    c.fillCapsule(19, 19, 27, 27, 2.2, 2.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    c.fillEllipse(13, 13, 8.8, 8.8, 0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillEllipse(13, 13, 6.2, 6.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.glass, light, x, y, 0.02),
    );
    c.fillCapsule(9, 13, 17, 13, 1.2, 1.2, () => RAMPS.gold.light);
  }),

  pan: paintHud((c) => {
    c.fillCapsule(16, 6, 16, 26, 1.4, 1.4, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillCapsule(6, 16, 26, 16, 1.4, 1.4, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    for (const tri of [
      [
        [16, 2],
        [20, 7],
        [12, 7],
      ],
      [
        [16, 30],
        [20, 25],
        [12, 25],
      ],
      [
        [2, 16],
        [7, 12],
        [7, 20],
      ],
      [
        [30, 16],
        [25, 12],
        [25, 20],
      ],
    ] as const) {
      c.fillPoly(tri, (x, y) => {
        putCC(c, x, y);
        return null;
      });
    }
    c.fillEllipse(16, 16, 3.2, 3.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.1, x, y, 0.02),
    );
  }),

  log: paintHud((c) => TAB_SPRITES.rules && (c.fillPoly(
    [
      [7, 6],
      [25, 6],
      [25, 25],
      [7, 25],
    ],
    (x, y, _nx, _ny, _nz, light, u, v) => {
      const ink = v > 0.2 && v < 0.72 && u > 0.18 && u < 0.8 && Math.floor(y) % 3 === 0 ? -0.35 : 0;
      return quantRamp(RAMPS.parchment, light + ink, x, y, 0.02);
    },
  ),
  c.fillCapsule(6, 6, 26, 6, 2, 2, (x, y, _nx, _ny, _nz, light) =>
    quantRamp(RAMPS.wood, light, x, y, 0.02),
  ),
  c.fillCapsule(6, 25, 26, 25, 2, 2, (x, y, _nx, _ny, _nz, light) =>
    quantRamp(RAMPS.wood, light * 0.9, x, y, 0.02),
  ),
  c.fillEllipse(21, 21, 3, 3, 0, () => RAMPS.crimson.light))),

  audioOn: paintHud((c) => {
    c.fillPoly(
      [
        [5, 12],
        [11, 12],
        [18, 6],
        [18, 26],
        [11, 20],
        [5, 20],
      ],
      (x, y) => {
        putCC(c, x, y);
        return null;
      },
    );
    c.fillBezier(22, 11, 25, 16, 22, 21, 1.1, 1.1, () => RAMPS.leaf.light);
    c.fillBezier(25, 8, 29, 16, 25, 24, 1.1, 1.1, () => RAMPS.leaf.mid);
  }),

  audioOff: paintHud((c) => {
    c.fillPoly(
      [
        [5, 12],
        [11, 12],
        [18, 6],
        [18, 26],
        [11, 20],
        [5, 20],
      ],
      (x, y) => {
        putCC(c, x, y);
        return null;
      },
    );
    c.fillCapsule(21, 11, 28, 21, 1.3, 1.3, () => RAMPS.crimson.light);
    c.fillCapsule(28, 11, 21, 21, 1.3, 1.3, () => RAMPS.crimson.light);
  }),

  pause: paintHud((c) => {
    c.fillPoly(
      [
        [7, 6],
        [13, 6],
        [13, 26],
        [7, 26],
      ],
      (x, y) => {
        putCC(c, x, y);
        return null;
      },
    );
    c.fillPoly(
      [
        [19, 6],
        [25, 6],
        [25, 26],
        [19, 26],
      ],
      (x, y) => {
        putCC(c, x, y);
        return null;
      },
    );
  }),

  play: paintHud((c) => {
    c.fillPoly(
      [
        [8, 5],
        [27, 16],
        [8, 27],
      ],
      (x, y) => {
        putCC(c, x, y);
        return null;
      },
    );
  }),

  reset: paintHud((c) => {
    c.fillBezier(24, 19, 18, 28, 9, 22, 2.0, 2.0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillBezier(9, 22, 5, 11, 15, 7, 2.0, 2.0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillBezier(15, 7, 21, 6, 24, 10, 2.0, 2.0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillPoly(
      [
        [25, 5],
        [27, 13],
        [19, 12],
      ],
      () => RAMPS.gold.light,
    );
  }),

  save: paintHud((c) => {
    c.fillPoly(
      [
        [5, 5],
        [24, 5],
        [27, 8],
        [27, 27],
        [5, 27],
      ],
      (x, y) => {
        putCC(c, x, y);
        return null;
      },
    );
    c.fillPoly(
      [
        [9, 5],
        [22, 5],
        [22, 13],
        [9, 13],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.steel, light, x, y, 0.02),
    );
    c.fillPoly(
      [
        [17, 6],
        [20, 6],
        [20, 12],
        [17, 12],
      ],
      () => RAMPS.gold.mid,
    );
    c.fillPoly(
      [
        [9, 17],
        [23, 17],
        [23, 25],
        [9, 25],
      ],
      () => RAMPS.parchment.hi,
    );
  }),

  camera: paintHud((c) => {
    c.fillPoly(
      [
        [10, 5],
        [22, 5],
        [24, 9],
        [28, 9],
        [28, 25],
        [4, 25],
        [4, 9],
        [8, 9],
      ],
      (x, y) => {
        putCC(c, x, y);
        return null;
      },
    );
    c.fillEllipse(16, 17, 5.5, 5.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.05, x, y, 0.02),
    );
    c.put(14, 15, [255, 255, 255]);
    c.put(24, 11, RAMPS.gold.light);
  }),

  speed: paintHud((c) => {
    c.fillPoly(
      [
        [5, 7],
        [17, 16],
        [5, 25],
      ],
      (x, y) => {
        putCC(c, x, y);
        return null;
      },
    );
    c.fillPoly(
      [
        [16, 7],
        [28, 16],
        [16, 25],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.gold, light * 1.1, x, y, 0.02),
    );
  }),

  chevronDown: paintHud((c) => {
    c.fillCapsule(6, 11, 16, 21, 2.0, 2.0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillCapsule(26, 11, 16, 21, 2.0, 2.0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
  }),

  chevronUp: paintHud((c) => {
    c.fillCapsule(6, 21, 16, 11, 2.0, 2.0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillCapsule(26, 21, 16, 11, 2.0, 2.0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
  }),

  sliders: paintHud((c) => {
    for (const [yy, kx, ramp] of [
      [8, 11, RAMPS.gold],
      [16, 21, RAMPS.leaf],
      [24, 13, RAMPS.azure],
    ] as const) {
      c.fillCapsule(4, yy, 28, yy, 1.3, 1.3, (x, y) => {
        putCC(c, x, y);
        return null;
      });
      c.fillEllipse(kx, yy, 3.2, 3.2, 0, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(ramp, light * 1.05, x, y, 0.02),
      );
    }
  }),

  settings: paintHud((c) => {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      c.fillCapsule(
        16,
        16,
        16 + Math.cos(a) * 12,
        16 + Math.sin(a) * 12,
        2.6,
        2.0,
        (x, y) => {
          putCC(c, x, y);
          return null;
        },
      );
    }
    c.fillEllipse(16, 16, 9, 9, 0, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillEllipse(16, 16, 4.2, 4.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.05, x, y, 0.02),
    );
  }),

  star: paintHud((c) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 11.5 : 5.0;
      pts.push([16 + Math.cos(a) * r, 16.5 + Math.sin(a) * r]);
    }
    c.fillPoly(pts, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillEllipse(16, 16.5, 3.6, 3.6, 0, () => [28, 24, 20]);
  }),

  starOn: paintHud((c) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 12 : 5.2;
      pts.push([16 + Math.cos(a) * r, 16.5 + Math.sin(a) * r]);
    }
    c.fillPoly(pts, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.12, x, y, 0.02),
    );
    c.sparkle(14, 12, RAMPS.gold.hi, false);
  }),

  close: paintHud((c) => {
    c.fillCapsule(7, 7, 25, 25, 2.2, 2.2, (x, y) => {
      putCC(c, x, y);
      return null;
    });
    c.fillCapsule(25, 7, 7, 25, 2.2, 2.2, (x, y) => {
      putCC(c, x, y);
      return null;
    });
  }),
};

// Suppress unused import lint if lerpRgb wasn't needed here
void lerpRgb;
