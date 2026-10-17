export interface GameSaveLocation {
  platformLabel: string;
  directory: string;
  fileName?: string;
  uploadKind: "file" | "folder";
  uploadLabel: string;
  notes?: string[];
}

export interface GameSaveVariant {
  id: string;
  label: string;
  saveLocations: GameSaveLocation[];
}

export interface GameParserMeta {
  gameId: string;
  gameName: string;
  icon: string;
  accepts: string[];
  bgImage: string;
  saveLocation?: string;
  saveLocations?: GameSaveLocation[];
  saveVariants?: GameSaveVariant[];
  themeColor?: string;
}

export interface StatItem {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export interface StatCategory {
  name: string;
  items: StatItem[];
}

export interface ParseResult {
  profileName: string;
  stats: StatCategory[];
  characters?: {
    id: string;
    label: string;
    level?: number;
    stats?: StatItem[];
  }[];
  detail: Record<string, unknown>;
}

export interface SaveBundleFile {
  name: string;
  path: string;
  size: number;
  lastModified?: number;
  data: ArrayBuffer;
}

export interface GameParseContext {
  fileName?: string;
  selectedVariantId?: string;
  steamId64?: string;
}

export interface GameParser {
  meta: GameParserMeta;
  identify?(file: ArrayBuffer, fileName: string): IdentityResult | Promise<IdentityResult>;
  validate(file: ArrayBuffer, fileName: string): boolean;
  detectVariant?(file: ArrayBuffer, fileName: string): string | undefined;
  parse(file: ArrayBuffer, context?: GameParseContext): ParseResult | Promise<ParseResult>;
  validateBundle?(files: SaveBundleFile[], context?: GameParseContext): boolean;
  identifyBundle?(files: SaveBundleFile[], context?: GameParseContext): IdentityResult | Promise<IdentityResult>;
  detectBundleVariant?(files: SaveBundleFile[]): string | undefined;
  parseBundle?(files: SaveBundleFile[], context?: GameParseContext): ParseResult | Promise<ParseResult>;
}
import type { IdentityResult } from "./identity";

