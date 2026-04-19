import { ArgumentMetadata, BadRequestException, Injectable, Logger, PipeTransform } from '@nestjs/common';

interface FileConstraints {
  maxSizeBytes: number;
  allowedMimes: string[];
  allowedMagicNumbers: Uint8Array[];
}

const MIME_CONSTRAINTS: Record<string, FileConstraints> = {
  ofx: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimes: ['application/octet-stream', 'application/x-ofx', 'text/plain', 'application/vnd.intu.qfx'],
    allowedMagicNumbers: [
      // OFX is a text format — starts with <OFX> or OFXHEADER
      new Uint8Array([0x3c, 0x4f, 0x46, 0x58]),   // <OFX
      new Uint8Array([0x4f, 0x46, 0x58, 0x48]),   // OFXH
    ],
  },
  xlsx: {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    allowedMagicNumbers: [
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // ZIP/XLSX magic
      new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), // OLE2/XLS magic
    ],
  },
  pdf: {
    maxSizeBytes: 20 * 1024 * 1024, // 20 MB
    allowedMimes: ['application/pdf'],
    allowedMagicNumbers: [
      new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
    ],
  },
  csv: {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimes: ['text/csv', 'text/plain', 'application/csv'],
    allowedMagicNumbers: [], // CSV is text — no magic number, rely on mime
  },
};

function checkMagicNumber(buffer: Buffer, allowed: Uint8Array[]): boolean {
  if (allowed.length === 0) return true; // no magic check for this type
  for (const magic of allowed) {
    let match = true;
    for (let i = 0; i < magic.length; i++) {
      if (buffer[i] !== magic[i]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

@Injectable()
export class FileValidationPipe implements PipeTransform<Express.Multer.File, Express.Multer.File> {
  private readonly logger = new Logger('FileValidation');

  constructor(private readonly fileType: keyof typeof MIME_CONSTRAINTS = 'ofx') {}

  transform(file: Express.Multer.File, _meta: ArgumentMetadata): Express.Multer.File {
    if (!file) throw new BadRequestException('File is required');

    const constraints = MIME_CONSTRAINTS[this.fileType];
    if (!constraints) throw new BadRequestException(`Unknown file type: ${this.fileType}`);

    // 1. Size check
    if (file.size > constraints.maxSizeBytes) {
      const maxMb = (constraints.maxSizeBytes / 1024 / 1024).toFixed(0);
      throw new BadRequestException(`File exceeds maximum size of ${maxMb}MB`);
    }

    // 2. MIME type check (from multer)
    const declaredMime = file.mimetype?.toLowerCase() ?? '';
    const mimeOk = constraints.allowedMimes.some((m) => declaredMime === m || declaredMime.startsWith(m));
    if (!mimeOk && constraints.allowedMimes.length > 0 && !constraints.allowedMimes.includes('application/octet-stream')) {
      this.logger.warn(`File rejected: mime ${declaredMime} not in allowed list for ${this.fileType}`);
      throw new BadRequestException(`Invalid file type. Expected: ${this.fileType.toUpperCase()}`);
    }

    // 3. Magic number check on buffer
    if (file.buffer && file.buffer.length >= 4 && constraints.allowedMagicNumbers.length > 0) {
      const magicOk = checkMagicNumber(file.buffer, constraints.allowedMagicNumbers);
      if (!magicOk) {
        this.logger.warn(`File rejected: magic number mismatch for ${this.fileType} (mime: ${declaredMime})`);
        throw new BadRequestException(`File content does not match expected format: ${this.fileType.toUpperCase()}`);
      }
    }

    return file;
  }
}

/** Factory helpers for common types */
export const OFXValidationPipe  = () => new FileValidationPipe('ofx');
export const XLSXValidationPipe = () => new FileValidationPipe('xlsx');
export const PDFValidationPipe  = () => new FileValidationPipe('pdf');
export const CSVValidationPipe  = () => new FileValidationPipe('csv');
