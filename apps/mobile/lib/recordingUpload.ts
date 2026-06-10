import { File } from 'expo-file-system';

import type { RecordingId, RecordingUploadPayload } from '@refrain/domain';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const decodeBase64 = (value: string): Uint8Array => {
  const sanitized = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const output: number[] = [];

  for (let index = 0; index < sanitized.length; index += 4) {
    const enc1 = BASE64_ALPHABET.indexOf(sanitized[index] ?? 'A');
    const enc2 = BASE64_ALPHABET.indexOf(sanitized[index + 1] ?? 'A');
    const enc3Raw = sanitized[index + 2] ?? '=';
    const enc4Raw = sanitized[index + 3] ?? '=';
    const enc3 = enc3Raw === '=' ? 64 : BASE64_ALPHABET.indexOf(enc3Raw);
    const enc4 = enc4Raw === '=' ? 64 : BASE64_ALPHABET.indexOf(enc4Raw);

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output.push(chr1);
    if (enc3 !== 64) {
      output.push(chr2);
    }
    if (enc4 !== 64) {
      output.push(chr3);
    }
  }

  return Uint8Array.from(output);
};

const getFileExtension = (uri: string): string => {
  const withoutQuery = uri.split('?')[0];
  const match = withoutQuery.match(/\.([a-z0-9]+)$/i);
  return (match?.[1] ?? 'm4a').toLowerCase();
};

const getMimeTypeForExtension = (extension: string): string => {
  switch (extension) {
    case 'wav':
      return 'audio/wav';
    case 'caf':
      return 'audio/x-caf';
    case 'webm':
      return 'audio/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'aac':
      return 'audio/aac';
    case '3gp':
      return 'audio/3gpp';
    case 'm4a':
    case 'mp4':
    default:
      return 'audio/mp4';
  }
};

export const doesLocalRecordingExist = async (uri: string | null | undefined): Promise<boolean> => {
  if (!uri) {
    return false;
  }
  return new File(uri).exists;
};

export const createRecordingUploadPayloadFromUri = async ({
  recordingId,
  uri,
  createdAt,
}: {
  recordingId: RecordingId;
  uri: string;
  createdAt?: number;
}): Promise<RecordingUploadPayload> => {
  const extension = getFileExtension(uri);
  const contentType = getMimeTypeForExtension(extension);
  const base64 = await new File(uri).base64();

  return {
    recordingId,
    data: decodeBase64(base64),
    contentType,
    extension,
    localUri: uri,
    createdAt,
  };
};
