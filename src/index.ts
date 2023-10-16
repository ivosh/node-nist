import { NistValidationError } from './nistError';
import { Result } from './result';

/**
 * Simple low-level ANSI/NIST-ITL 1-2011 (update 2015) encoding and decoding utility library.
 *
 * Current limitations:
 * - Supported records: Type-1, Type-2, Type-4, Type-9, Type-10, Type-13, Type-14.
 * - Only one Type-2 record is supported.
 * - Traditional (binary) encoding is used; NIEM-conformant (XML) is not supported.
 * - Information designation character (IDC) is automatically generated during encoding
 *   (linking of records is not supported).
 * - All Type-1 fields must be 7-bit ASCII.
 * - Only UTF-8 is supported for other record types.
 * - Only one Friction ridge generalized position (FGP, 4.004) is supported per one Type-4 record.
 * - Limit of the encoded NIST file length is 4 GB, as given by a size of one single Node Buffer.
 */

export type NistInformationItem = string | Buffer | undefined;
export type NistSubfield = NistInformationItem | NistInformationItem[];
export type NistFieldValue = NistSubfield | NistSubfield[];

/** Identification of a NIST field, colloquially represented for example as 1.003. */
export interface NistFieldKey {
  type: number; // which record Type-x (such as 9)
  record: number; // which record instance of multiple Type-4 records (mostly uninteresting)
  field: number; // which field (such as 302)
}

/**
 * How to represent field values:
 * 1. Field containing a single value:
 *   value: NistInformationItem (no separators used)
 * 2. Field containing multiple values that do not repeat:
 *   value: [[NistInformationItem(1), NistInformationItem(2), ...]] (uses unit separator)
 * 3. Field containing values with different formats that repeat as a set:
 *   value: [[NistInformationItem(1), NistInformationItem(2)], [NistInformationItem(3), NistInformationItem(4)]]
 *   (uses record separator between 2 and 3, unit separator between 1 and 2,
 *    unit separator between 3 and 4)
 * 4. Field containing a value that may have multiple entries:
 *   value: [NistInformationItem(1), NistInformationItem(2), ...] (uses record separator)
 * 5. A combination of all the above, for example
 *   value: [NistInformationItem(1), [NistInformationItem(2), NistInformationItem(3)], NistInformationItem(4)]
 *   is represented as 1<RS>2<US>3<RS>4
 */
export interface NistField {
  key: NistFieldKey;
  value: NistFieldValue;
}

/**
 * NIST File information. Must be present.
 * All strings must be 7-bit ASCII, no control characters.
 */
export interface NistType1Record {
  1?: /* len */ string /* computed automatically during encoding process */;
  2?: /* ver */ string /* default value 0502: ANSI/NIST-ITL 1-2011 edition 3 update 2015 */;
  3?: /* cnt */ [string, string][] /* computed automatically during encoding process */;
  4: /* tot */ string;
  5: /* dat */ string;
  6?: /* pry */ string;
  7: /* dai */ string;
  8: /* ori */ string;
  9: /* tcn */ string;
  10?: /* tcr */ string;
  11?: /* nsr */ string /* determined automatically from Type-4 or Type-14 */;
  12?: /* ntr */ string /* determined automatically from Type-4 or Type-14 */;
  // For all other fields not mentioned above:
  [key: number]: NistFieldValue;
}

/** User-defined data. */
export interface NistType2Record {
  [key: number]: NistFieldValue;
}

/** Grayscale fingerprint image with 500 ppi resolution. */
export interface NistType4Record {
  1?: /* len */ string /* computed automatically during encoding process */;
  2?: /* idc */ string /* computed automatically during encoding process */;
  3: /* imp */ string;
  4: /* fgp */ string[] /* 1-6 positions */;
  5?: /* isr */ string /* default value of 0 (500 ppi) */;
  6?: /* hll */ string /* determined automatically from WSQ image */;
  7?: /* vll */ string /* determined automatically from WSQ image */;
  8?: /* cga */ string /* default value of 1 (WSQ) */;
  9: /* data */ Buffer;
  // For all other fields not mentioned above:
  [key: number]: NistFieldValue;
}

/** Minutiae and related information encoded from a finger or palm. */
export interface NistType9Record {
  1?: /* len */ string /* computed automatically during encoding process */;
  2?: /* idc */ string /* computed automatically during encoding process */;
  3: /* imp */ string;
  4: /* fmt */ string;
  5?: /* ofr */ string;
  6?: /* fgp */ string;
  7?: /* fpc */ string;
  8?: /* crp */ string;
  9?: /* dlt */ string;
  10?: /* min */ string;
  11?: /* rdg */ string;
  12?: /* mrc */ string;
  // For all other fields not mentioned above:
  [key: number]: NistFieldValue;
}

/** Photographic body part imagery (including face and SMT). */
export interface NistType10Record {
  1?: /* len */ string /* computed automatically during encoding process */;
  2?: /* idc */ string /* computed automatically during encoding process */;
  3: /* imt */ string;
  4: /* src */ string;
  5: /* phd */ string;
  6: /* hll */ string;
  7: /* vll */ string;
  8: /* slc */ string;
  9: /* thps */ string;
  10: /* tvps */ string;
  11: /* cga */ string;
  12: /* csp */ string;
  13?: /* sap */ string;
  16?: /* shps */ string;
  17?: /* svps */ string;
  20?: /* pos */ string;
  21?: /* poa */ string;
  24?: /* sqs */ [string, string, string][];
  999: /* data */ Buffer;
  // For all other fields not mentioned above:
  [key: number]: NistFieldValue;
}

/** Variable-resolution latent friction ridge image. */
export interface NistType13Record {
  1?: /* len */ string /* computed automatically during encoding process */;
  2?: /* idc */ string /* computed automatically during encoding process */;
  3: /* imp */ string;
  4: /* src */ string;
  5: /* lcd */ string;
  6: /* hll */ string;
  7: /* vll */ string;
  8: /* slc */ string;
  9: /* thps */ string;
  10: /* tvps */ string;
  11: /* cga */ string;
  12: /* bpx */ string;
  13: /* fgp */ string[];
  999: /* data */ Buffer;
  // For all other fields not mentioned above:
  [key: number]: NistFieldValue;
}

/** Variable-resolution fingerprint image. */
export interface NistType14Record {
  1?: string;
  2?: string;
  3?: string;
  4: string;
  5: string;
  6?: string;
  7?: string;
  8?: string;
  9?: string;
  10?: string;
  11?: string;
  12?: string;
  13: string[];
  14?: [string, string];
  15?: [string, string, string, string, string, string][];
  16?: string;
  17?: string;
  18?: [string, string][];
  20?: string;
  21?: [string, string, string, string, string, string][];
  22?: [string, string][];
  23?: [string, string, string, string][];
  24?: [string, string, string, string][];
  25?: [string, string, string, string][];
  26?: string;
  27?: string;
  30?: string;
  31?: string;
  999?: Buffer;
  [key: number]: NistFieldValue;
}

export type NistRecord =
  | NistType1Record
  | NistType2Record
  | NistType4Record
  | NistType9Record
  | NistType10Record
  | NistType13Record
  | NistType14Record;

export interface NistFile {
  1: NistType1Record;
  2?: NistType2Record;
  4?: NistType4Record[];
  9?: NistType9Record[];
  10?: NistType10Record[];
  13?: NistType13Record[];
  14?: NistType14Record[];
}

type DefaultValueFn = (field: NistField, nist: NistFile) => NistFieldValue;
type MandatoryFn = (field: NistField, nist: NistFile) => boolean;
type MaxLengthFn = (field: NistField, nist: NistFile) => number;
type MinLengthFn = (field: NistField, nist: NistFile) => number;
interface Regex {
  regex: string;
  errMsg: string;
}
type RegexFn = (field: NistField, nist: NistFile) => Regex;
type ValidationFn = (field: NistField, nist: NistFile) => Result<void, NistValidationError>;

/** Common encoding and decoding options for a single NIST Field. */
export interface NistFieldCodecOptions {
  defaultValue?: NistFieldValue | DefaultValueFn;
  mandatory?: boolean | MandatoryFn;
  maxLength?: number | MaxLengthFn;
  minLength?: number | MinLengthFn;
  regexs?: (Regex | RegexFn)[];
  validationRules?: ValidationFn[];
}

/** Common encoding and decoding options for one NIST record. */
export interface NistRecordCodecOptions<T extends NistFieldCodecOptions> {
  [key: number]: T;
}

/**
 * Common encoding and decoding options for a NIST file.
 * Represents codec options for default or TOT-specific processing.
 */
export interface NistFileCodecOptionsPerTot<
  T extends NistFieldCodecOptions,
  U extends NistRecordCodecOptions<T>,
> {
  [key: number]: U;
}

/** Common encoding and decoding options for a NIST file, all processing paths. */
export interface NistFileCodecOptions<
  T extends NistFieldCodecOptions,
  U extends NistRecordCodecOptions<T>,
> {
  /** Codec options common to all processing paths. */
  default: NistFileCodecOptionsPerTot<T, U>;
  /** TOT-specific codec options, accessed by TOT name (case sensitive). */
  [specific: string]: NistFileCodecOptionsPerTot<T, U>;
}

/** Common NIST encoding and decoding options. */
export interface NistCodecOptions<
  T extends NistFieldCodecOptions,
  U extends NistRecordCodecOptions<T>,
  V extends NistFileCodecOptions<T, U>,
> {
  ignoreMissingMandatoryFields?: boolean;
  ignoreValidationChecks?: boolean;
  codecOptions?: V;
}

export { nistDecode, NistDecodeOptions } from './nistDecode';
export { nistEncode, NistEncodeOptions } from './nistEncode';
export { NistError } from './nistError';
export { Dimensions, getImageHeader, ImageHeader, Resolution } from './imageHeader';
