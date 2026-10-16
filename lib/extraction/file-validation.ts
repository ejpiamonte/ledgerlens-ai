export function hasMatchingFileSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'application/pdf')
    return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
  if (mimeType === 'image/png')
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  if (mimeType === 'image/jpeg')
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}
