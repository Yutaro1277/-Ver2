import { Blob } from '@google/genai';

export const PCM_SAMPLE_RATE = 16000;

/**
 * Resamples audio data from any source rate to the target rate (16kHz) using Linear Interpolation.
 */
export function resampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number = PCM_SAMPLE_RATE): Float32Array {
  if (inputRate === outputRate) {
    return buffer;
  }
  
  const ratio = inputRate / outputRate;
  // Use floor to ensure we don't try to access samples beyond the buffer
  const newLength = Math.floor(buffer.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const inputIndex = i * ratio;
    const index = Math.floor(inputIndex);
    const decimal = inputIndex - index;
    
    const p0 = buffer[index] || 0;
    const p1 = (index + 1 < buffer.length) ? buffer[index + 1] : p0;
    
    result[i] = p0 + (p1 - p0) * decimal;
  }
  
  return result;
}

/**
 * Converts Float32Array audio data (from Web Audio API) to Int16 PCM and returns a Google GenAI Blob.
 */
export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to -1..1 range before scaling to avoid wrapping distortion
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: arrayBufferToBase64(int16.buffer),
    mimeType: 'audio/pcm;rate=16000',
  };
}

/**
 * Helper to convert ArrayBuffer to Base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 to ArrayBuffer decoder.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Decodes raw PCM data into an AudioBuffer for playback.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}