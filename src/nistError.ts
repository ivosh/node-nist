/** Common base for all NIST errors. */
interface NistErrorBase {
  /** Category of the error. */
  category: 'NIST';

  /** Specific reason code. */
  code?: string;

  /** Detailed message. */
  detail: string;

  /** Source as a string. Required for compatibility with other errors. */
  source?: string;

  /** Source as a NIST field. */
  nistSource?: { type: number; record: number; field: number };

  /** A cause (if any). */
  cause?: Error;
}

export interface NistValidationError extends NistErrorBase {
  category: 'NIST';
  code: 'NIST_VALIDATION_ERROR';
  detail: string;
  source: string;
  nistSource: { type: number; record: number; field: number };
}

export interface NistParseError extends NistErrorBase {
  category: 'NIST';
  code: 'NIST_PARSE_ERROR';
  detail: string;
  source: string;
  nistSource: { type: number; record: number; field: number };
}

export interface NistDecodeError extends NistErrorBase {
  category: 'NIST';
  code: 'NIST_DECODE_ERROR';
  detail: string;
  source?: string;
  nistSource?: { type: number; record: number; field: number; subField?: number };
  startOffset?: number;
  endOffset?: number;
}

export interface NistEncodeError extends NistErrorBase {
  category: 'NIST';
  code: 'NIST_ENCODE_ERROR';
  detail: string;
  cause?: Error;
}

export type NistError = NistValidationError | NistParseError | NistDecodeError | NistEncodeError;
