import {
  MAP_ASSET_UPLOAD_EXTENSIONS,
  assertAllowedFileExtension,
  assertFileSize,
  limitForExtension,
} from '../utils/file-validation';
import {
  PDF_MIME_TYPE,
  isPdfFileName,
  normalizePdfBlob,
} from '../utils/pdf-validation';

export interface PreparedMapAssetUpload {
  fileName: string;
  blob: Blob;
  mimeType: string;
}

export async function prepareMapAssetUploadFile(
  file: File
): Promise<PreparedMapAssetUpload> {
  assertAllowedFileExtension(
    file.name,
    MAP_ASSET_UPLOAD_EXTENSIONS,
    'Map asset'
  );
  const limit = limitForExtension(file.name);
  assertFileSize(file, limit.bytes, limit.label);

  const isPdf =
    isPdfFileName(file.name) || file.type.toLowerCase().includes('pdf');
  if (isPdf) {
    const blob = await normalizePdfBlob(file, file.name);
    return {
      fileName: file.name,
      blob,
      mimeType: PDF_MIME_TYPE,
    };
  }

  return {
    fileName: file.name,
    blob: file,
    mimeType: file.type || 'application/octet-stream',
  };
}
