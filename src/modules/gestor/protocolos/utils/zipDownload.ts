interface ZipEntry {
  name: string;
  content: string;
}

const encoder = new TextEncoder();

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return crc >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
};

const uint16 = (value: number) => new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);

const uint32 = (value: number) => new Uint8Array([
  value & 0xff,
  (value >>> 8) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 24) & 0xff,
]);

const concat = (chunks: Uint8Array[]) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
};

const localFileHeader = (name: Uint8Array, content: Uint8Array, checksum: number) => concat([
  uint32(0x04034b50),
  uint16(20),
  uint16(0x0800),
  uint16(0),
  uint16(0),
  uint16(0),
  uint32(checksum),
  uint32(content.length),
  uint32(content.length),
  uint16(name.length),
  uint16(0),
  name,
  content,
]);

const centralDirectoryHeader = (name: Uint8Array, content: Uint8Array, checksum: number, offset: number) => concat([
  uint32(0x02014b50),
  uint16(20),
  uint16(20),
  uint16(0x0800),
  uint16(0),
  uint16(0),
  uint16(0),
  uint32(checksum),
  uint32(content.length),
  uint32(content.length),
  uint16(name.length),
  uint16(0),
  uint16(0),
  uint16(0),
  uint16(0),
  uint32(0),
  uint32(offset),
  name,
]);

export const downloadZip = (fileName: string, entries: ZipEntry[]) => {
  const files = entries.length > 0 ? entries : [{ name: 'sem-arquivos.txt', content: 'Nenhum arquivo selecionado.' }];
  const localFiles: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  files.forEach((entry) => {
    const name = encoder.encode(entry.name);
    const content = encoder.encode(entry.content);
    const checksum = crc32(content);
    const local = localFileHeader(name, content, checksum);
    localFiles.push(local);
    centralDirectory.push(centralDirectoryHeader(name, content, checksum, offset));
    offset += local.length;
  });

  const central = concat(centralDirectory);
  const end = concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(central.length),
    uint32(offset),
    uint16(0),
  ]);
  const blob = new Blob([concat([...localFiles, central, end])], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.zip') ? fileName : `${fileName}.zip`;
  link.click();
  URL.revokeObjectURL(url);
};
