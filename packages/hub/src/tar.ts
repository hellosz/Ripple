/** 极简 tar 读取器（USTAR，够解析 GitHub codeload tarball） */
export interface TarEntry {
  path: string;
  data: Uint8Array;
}

export function parseTar(data: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const name = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, '');
    const prefix = decoder.decode(header.subarray(345, 500)).replace(/\0.*$/, '');
    const sizeOctal = decoder.decode(header.subarray(124, 136)).replace(/\0.*$/, '').trim();
    const size = parseInt(sizeOctal || '0', 8);
    const typeflag = String.fromCharCode(header[156] ?? 48);
    offset += 512;
    const fullPath = prefix ? `${prefix}/${name}` : name;
    if ((typeflag === '0' || typeflag === '\0' || typeflag === '') && fullPath) {
      entries.push({ path: fullPath, data: data.subarray(offset, offset + size) });
    }
    offset += Math.ceil(size / 512) * 512;
  }
  return entries;
}
