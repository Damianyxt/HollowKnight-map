export type SaveFileLike = {
  name: string;
  webkitRelativePath?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ParsedSaveSlot = {
  slotId: string;
  slotNumber: number;
  detail: Record<string, unknown>;
};

export type SaveParseFailure = { slot: number; message: string };

export type SaveDirectoryResult = {
  slots: ParsedSaveSlot[];
  failures: SaveParseFailure[];
  error?: string;
};

export type ParseSlot = (
  data: ArrayBuffer,
  slotNumber: number,
) =>
  | Promise<{ slotId?: string; detail: Record<string, unknown> }>
  | { slotId?: string; detail: Record<string, unknown> };
