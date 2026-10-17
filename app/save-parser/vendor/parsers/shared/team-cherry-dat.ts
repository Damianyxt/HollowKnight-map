import aesjs from "aes-js";

const BINARY_FORMATTER_STRING_HEADER = Uint8Array.from([
  0, 1, 0, 0, 0, 255, 255, 255, 255, 1, 0, 0, 0, 0, 0, 0, 0, 6, 1, 0, 0, 0,
]);
const TEAM_CHERRY_AES_KEY = new TextEncoder().encode("UKu52ePUBwetZ9wNX88o54dnfKRu0T1l");
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const BASE64_DECODE_TABLE = new Map(
  [...BASE64_ALPHABET].map((char, index) => [char.charCodeAt(0), index]),
);

function startsWithBytes(bytes: Uint8Array, prefix: Uint8Array) {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

function readLengthPrefixedString(
  bytes: Uint8Array,
  offset: number,
): { text: string; endOffset: number } | null {
  let length = 0;
  let shift = 0;
  let index = offset;
  for (let count = 0; count < 5; count += 1) {
    const byte = bytes[index];
    if (typeof byte === "undefined") return null;
    index += 1;
    length |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  const endOffset = index + length;
  if (length < 0 || endOffset > bytes.length) return null;
  return {
    text: new TextDecoder("utf-8").decode(bytes.subarray(index, endOffset)),
    endOffset,
  };
}

function readBinaryFormatterString(bytes: Uint8Array): string | null {
  if (!startsWithBytes(bytes, BINARY_FORMATTER_STRING_HEADER)) return null;
  const payload = readLengthPrefixedString(bytes, BINARY_FORMATTER_STRING_HEADER.length);
  if (!payload || bytes[payload.endOffset] !== 11) return null;
  return payload.text;
}

function decodeBase64Bytes(text: string): Uint8Array | null {
  const clean = text.replace(/\s+/gu, "");
  if (!clean || clean.length % 4 !== 0) return null;
  const values: number[] = [];
  for (let index = 0; index < clean.length; index += 1) {
    const value = BASE64_DECODE_TABLE.get(clean.charCodeAt(index));
    if (typeof value === "undefined") return null;
    values.push(value);
  }
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const output = new Uint8Array((values.length / 4) * 3 - padding);
  let outIndex = 0;
  for (let index = 0; index < values.length; index += 4) {
    const first = values[index] ?? 0;
    const second = values[index + 1] ?? 0;
    const third = values[index + 2] ?? 0;
    const fourth = values[index + 3] ?? 0;
    if (outIndex < output.length) output[outIndex++] = (first << 2) | (second >> 4);
    if (outIndex < output.length) output[outIndex++] = ((second & 0x0f) << 4) | (third >> 2);
    if (outIndex < output.length) output[outIndex++] = ((third & 0x03) << 6) | fourth;
  }
  return output;
}

function decryptAesEcbPkcs7(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length === 0 || bytes.length % 16 !== 0) return null;
  try {
    const decrypted = new Uint8Array(
      new aesjs.ModeOfOperation.ecb(Array.from(TEAM_CHERRY_AES_KEY)).decrypt(Array.from(bytes)),
    );
    const padding = decrypted[decrypted.length - 1];
    if (!padding || padding > 16 || padding > decrypted.length) return null;
    for (let index = decrypted.length - padding; index < decrypted.length; index += 1) {
      if (decrypted[index] !== padding) return null;
    }
    return decrypted.subarray(0, decrypted.length - padding);
  } catch {
    return null;
  }
}

export function decodeTeamCherryDatText(file: ArrayBuffer): string | null {
  const wrapped = readBinaryFormatterString(new Uint8Array(file));
  if (!wrapped) return null;
  const encrypted = decodeBase64Bytes(wrapped);
  if (!encrypted) return null;
  const decrypted = decryptAesEcbPkcs7(encrypted);
  return decrypted ? new TextDecoder("utf-8").decode(decrypted).trim() : null;
}

