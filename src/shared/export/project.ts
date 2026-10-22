/**
 * Proyecto editable de DotSnap (.dotsnap.json, versión 1): la imagen original en PNG (base64) y
 * las anotaciones. Como lleva la imagen ORIGINAL, los píxeles bajo una censura siguen dentro del
 * archivo: nunca debe compartirse como si fuera la imagen exportada.
 */
import { parseAnnotations, type Annotation } from '../../editor/model';
import { decodeDataUrl } from '../capture/dataUrl';

export const PROJECT_FORMAT = 'dotsnap-project';
export const PROJECT_VERSION = 1;
export const MAX_PROJECT_BYTES = 120 * 1024 * 1024;

export interface ProjectData {
  image: Blob;
  annotations: Annotation[];
  width: number;
  height: number;
}

async function toDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:image/png;base64,${btoa(binary)}`;
}

export async function serializeProject(
  image: Blob,
  annotations: readonly Annotation[],
  width: number,
  height: number,
  now = new Date(),
): Promise<Blob> {
  const body = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    createdAt: now.toISOString(),
    width,
    height,
    image: await toDataUrl(image),
    annotations,
  };
  return new Blob([JSON.stringify(body)], { type: 'application/json' });
}

export class ProjectError extends Error {
  constructor(readonly code: 'invalid' | 'tooLarge' | 'newer') {
    super(code);
  }
}

/** Valida un archivo de proyecto sin confiar en nada de él; lanza ProjectError si no es válido. */
export function parseProject(text: string): ProjectData {
  if (text.length > MAX_PROJECT_BYTES) throw new ProjectError('tooLarge');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProjectError('invalid');
  }
  if (typeof raw !== 'object' || raw === null)
    throw new ProjectError('invalid');
  const o = raw as Record<string, unknown>;
  if (o.format !== PROJECT_FORMAT) throw new ProjectError('invalid');
  if (typeof o.version !== 'number') throw new ProjectError('invalid');
  if (o.version > PROJECT_VERSION) throw new ProjectError('newer');
  if (o.version !== PROJECT_VERSION) throw new ProjectError('invalid');
  const { width, height } = o;
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  )
    throw new ProjectError('invalid');
  const annotations = parseAnnotations(o.annotations);
  if (!annotations || typeof o.image !== 'string')
    throw new ProjectError('invalid');
  let image: Blob;
  try {
    image = decodeDataUrl(o.image);
  } catch {
    throw new ProjectError('invalid');
  }
  return { image, annotations, width, height };
}
