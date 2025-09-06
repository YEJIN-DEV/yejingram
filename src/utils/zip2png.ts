import JSZip from 'jszip';

interface UnzippedPng {
    mimeType: string;
    data: string;
}

/**
 * Unzips binary data and returns PNG files as base64 data URLs
 * @param binaryData - The binary ZIP data (Uint8Array, ArrayBuffer, or Blob)
 * @returns Promise<UnzippedPng[]> - Array of PNG files with their data URLs
 */
export const unzipToDataUrls = async (
  binaryData: Uint8Array | ArrayBuffer | Blob
): Promise<UnzippedPng> => {
  try {
    const zip = await JSZip.loadAsync(binaryData);
    
    // Get the first file (assuming single file)
    const files = Object.values(zip.files).filter(file => !file.dir);
    
    if (files.length === 0) {
      throw new Error('No files found in ZIP');
    }
    
    const file = files[0];
    const content = await file.async('uint8array');
    const base64 = uint8ArrayToBase64(content);
    
    return {
      mimeType: 'image/png',
      data: base64
    };
  } catch (error) {
    throw new Error(`Failed to unzip file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const uint8ArrayToBase64 = (uint8Array: Uint8Array): string => {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
};