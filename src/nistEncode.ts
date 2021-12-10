import buffer from 'buffer';
import {
  NistCodecOptions,
  NistField,
  NistFieldCodecOptions,
  NistFieldValue,
  NistFile,
  NistFileCodecOptions,
  NistInformationItem,
  NistRecordCodecOptions,
  NistSubfield,
  NistType4Record,
} from './index';
import { NistEncodeError, NistValidationError } from './nistError';
import {
  formatFieldKey,
  nistValidationError,
  provideDefaults,
  SEPARATOR_FIELD_NUMBER,
  SEPARATOR_FILE,
  SEPARATOR_GROUP,
  SEPARATOR_RECORD,
  SEPARATOR_UNIT,
} from './nistUtils';
import { check7bitAscii, nistValidation } from './nistValidation';
import {
  NistFieldVisitorFn,
  NistFieldVisitorFnReturn,
  NistRecordVisitorFn,
  shallowCopyNistFile,
  visitNistFile,
  visitNistRecord,
} from './nistVisitor';
import { failure, Result, success } from './result';

/** Encoding options for a single NIST Field. */
interface NistFieldEncodeOptions extends NistFieldCodecOptions {
  formatter?: (field: NistField, nist: NistFile) => NistFieldValue;
}

/** Encoding options for one NIST record. */
type NistRecordEncodeOptions = NistRecordCodecOptions<NistFieldEncodeOptions>;

/** Encoding options for a NIST file. */
type NistFileEncodeOptions = NistFileCodecOptions<NistFieldEncodeOptions, NistRecordEncodeOptions>;

export type NistEncodeOptions = NistCodecOptions<
  NistFieldEncodeOptions,
  NistRecordEncodeOptions,
  NistFileEncodeOptions
>;

/* --------------------------- Defaults, formatters --------------------------------------------- */

const formatNistField: NistFieldVisitorFn<void, NistFieldEncodeOptions> = (
  params
): NistFieldVisitorFnReturn => {
  const { field, nist, options } = params;
  if (options && options.formatter) {
    return success(options.formatter(field, nist));
  }
  return success(undefined);
};

const invokeFormatters = ({
  nist,
  options,
}: {
  nist: NistFile;
  options: NistEncodeOptions;
}): Result<void, NistValidationError> => {
  visitNistFile<void, NistFieldEncodeOptions, NistRecordEncodeOptions>({
    fieldVisitor: { fn: formatNistField, data: undefined },
    nist,
    options: options && options.codecOptions,
    visitorStrategy: {},
  });

  return success(undefined);
};

/* --------------------------- Automatic fields ------------------------------------------------- */

const determineCharset = ({ nist }: { nist: NistFile }): Result<void, NistValidationError> => {
  const result = visitNistFile<void, NistFieldEncodeOptions, NistRecordEncodeOptions>({
    fieldVisitor: { fn: check7bitAscii, data: undefined },
    nist,
    visitorStrategy: {},
  });
  if (result.tag === 'failure') {
    /*
     * Note: There is some ambiguity in NIST standard regarding whether to indicate UTF-8
     * charset with field 1.015. Section 5.5, Annex A and Annex B imply that 1.015 is needed
     * while section 8 implies it is not needed.
     */
    nist[1][15] = [['3', 'UTF-8']];
  }

  return success(undefined);
};

interface IdcTracking {
  currentIdc: number;
  contentRecordCount: number;
  records: [string /* record */, string /* IDC */][];
}
const assignIDC: NistRecordVisitorFn<IdcTracking, NistFieldEncodeOptions> = (
  params
): Result<void, NistValidationError> => {
  const { record, recordTypeNumber, data } = params;
  if (recordTypeNumber > 1) {
    record[2] = String(data.currentIdc).padStart(2, '0'); // IDC
    data.currentIdc += 1;
    data.contentRecordCount += 1;
    data.records.push([String(recordTypeNumber), record[2]]);
  }
  return success(undefined);
};

interface LengthTracking {
  recordLength: number;
  totalLength: number;
}

const informationItemLength = (informationItem: NistInformationItem): number =>
  informationItem
    ? typeof informationItem === 'string'
      ? Buffer.byteLength(informationItem) // utf-8 is the default
      : informationItem.byteLength
    : 0;

const subfieldLength = (subfield: NistSubfield): number =>
  Array.isArray(subfield)
    ? subfield.reduce(
        (total, informationItem) => total + informationItemLength(informationItem),
        0
      ) +
      (subfield.length - 1) // unit separators
    : informationItemLength(subfield);

const fieldValueLength = (value: NistFieldValue): number =>
  Array.isArray(value)
    ? (value as NistInformationItem[]).reduce(
        (total, subfield) => total + subfieldLength(subfield),
        0
      ) +
      (value.length - 1) // record separators
    : subfieldLength(value);

const computeFieldLength = (field: NistField): number => {
  const fieldNumberLength = formatFieldKey(field.key.type, field.key.field).length;
  const valueLength = fieldValueLength(field.value);
  return fieldNumberLength + 1 + valueLength + 1; // 1 for ':', 1 for group separator
};

const assignFieldLength: NistFieldVisitorFn<LengthTracking, NistFieldEncodeOptions> = ({
  field,
  data,
}): NistFieldVisitorFnReturn => {
  data.recordLength += computeFieldLength(field);
  return success(undefined);
};

const assignRecordLength: NistRecordVisitorFn<LengthTracking, NistFieldEncodeOptions> = (
  params
): Result<void, NistValidationError> => {
  const { nist, recordTypeNumber, record, recordNumber, visitorStrategy, data } = params;

  let recordLength;
  if (recordTypeNumber === 4) {
    recordLength = 18 + (record as NistType4Record)[9].byteLength; // no file separator
  } else {
    // 1. Compute length of all the fields, including separators.
    data.recordLength = 0;
    const result = visitNistRecord<LengthTracking, NistFieldEncodeOptions>({
      data: { recordLength: 0, totalLength: 0 }, // not used
      fieldVisitor: { fn: assignFieldLength, data },
      nist,
      record,
      recordNumber,
      recordTypeNumber,
      visitorStrategy,
    });
    if (result.tag === 'failure') {
      return result;
    }

    // 2. Compute length of xx.001 field (LEN).
    const partialRecordLength = data.recordLength;
    const lengthOfRecordLength = computeFieldLength({
      key: { type: recordTypeNumber, record: recordNumber, field: 1 },
      value: String(partialRecordLength),
    });
    recordLength = lengthOfRecordLength + partialRecordLength;
    if (Buffer.byteLength(String(recordLength)) > Buffer.byteLength(String(partialRecordLength))) {
      // Account for overflow of the record length value.
      // Let's say partial record length (length of all fields without LEN field) is 99.
      // So original (byte) length of LEN field value is 2 bytes.
      // But computed record length would be 108, which is 3 bytes.
      // So there is an overflow 99 => 108 and we need to adjust (byte) length of LEN field value.
      recordLength += 1;
    }
  }
  record[1] = String(recordLength);
  data.totalLength += recordLength;

  return success(undefined);
};

const computeAutomaticFields = ({
  nist,
}: {
  nist: NistFile;
}): Result<number, NistValidationError> => {
  const tracking = { currentIdc: 0, contentRecordCount: 0, records: [] };
  // 1. assign IDCs to xx.002 and determine value for 1.003
  let result = visitNistFile<IdcTracking, NistFieldEncodeOptions, NistRecordEncodeOptions>({
    nist,
    recordVisitor: { fn: assignIDC, data: tracking },
    visitorStrategy: {},
  });
  if (result.tag === 'failure') {
    return result;
  }

  // 2. set 1.003 (CNT)
  nist[1][3] = [['1', String(tracking.contentRecordCount)], ...tracking.records];

  // 3. assign record lengths (xx.001)
  const lengthTracking = { recordLength: 0, totalLength: 0 };
  result = visitNistFile<LengthTracking, NistFieldEncodeOptions, NistRecordEncodeOptions>({
    nist,
    recordVisitor: { fn: assignRecordLength, data: lengthTracking },
    visitorStrategy: {},
  });
  if (result.tag === 'failure') {
    return result;
  }

  return success(lengthTracking.totalLength);
};

/* --------------------------- Serialization ---------------------------------------------------- */

interface EncodeTracking {
  buf: Buffer;
  offset: number;
}

const toNumber = (
  recordTypeNumber: number,
  recordNumber: number,
  fieldNumber: number,
  value?: NistFieldValue
): Result<number, NistValidationError> => {
  if (!value) {
    return failure(
      nistValidationError(`Missing value for ${formatFieldKey(recordTypeNumber, fieldNumber)}`, {
        field: fieldNumber,
        record: recordNumber,
        type: recordTypeNumber,
      })
    );
  }
  if (typeof value !== 'string') {
    return failure(
      nistValidationError(
        `Invalid value format for ${formatFieldKey(recordTypeNumber, fieldNumber)}: ${value}`,
        { type: recordTypeNumber, record: recordNumber, field: fieldNumber }
      )
    );
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return failure(
      nistValidationError(
        `Invalid value for ${formatFieldKey(recordTypeNumber, fieldNumber)}: ${value}`,
        { type: recordTypeNumber, record: recordNumber, field: fieldNumber }
      )
    );
  }

  return success(num);
};

const encodeType4Record = (
  record: NistType4Record,
  recordNumber: number,
  data: EncodeTracking
): Result<void, NistValidationError> => {
  const length = toNumber(4, recordNumber, 1, record[1]);
  if (length.tag === 'failure') {
    return failure(length.error);
  }
  data.offset = data.buf.writeUInt32BE(length.value, data.offset);

  const idc = toNumber(4, recordNumber, 2, record[2]);
  if (idc.tag === 'failure') {
    return failure(idc.error);
  }
  data.offset = data.buf.writeUInt8(idc.value, data.offset);

  const imp = toNumber(4, recordNumber, 3, record[3]);
  if (imp.tag === 'failure') {
    return failure(imp.error);
  }
  data.offset = data.buf.writeUInt8(imp.value, data.offset);

  const positions = Buffer.from([255, 255, 255, 255, 255, 255]); // initialize with unused positions
  for (let index = 0; index < record[4].length; index += 1) {
    if (record[4][index]) {
      const fgp = toNumber(4, recordNumber, 4, record[4][index]);
      if (fgp.tag === 'failure') {
        return failure(fgp.error);
      }
      positions[index] = fgp.value;
    }
  }
  data.offset += positions.copy(data.buf, data.offset);

  const isr = toNumber(4, recordNumber, 5, record[5]);
  if (isr.tag === 'failure') {
    return failure(isr.error);
  }
  data.offset = data.buf.writeUInt8(isr.value, data.offset);

  const hll = toNumber(4, recordNumber, 6, record[6]);
  if (hll.tag === 'failure') {
    return failure(hll.error);
  }
  data.offset = data.buf.writeInt16BE(hll.value, data.offset);

  const vll = toNumber(4, recordNumber, 7, record[7]);
  if (vll.tag === 'failure') {
    return failure(vll.error);
  }
  data.offset = data.buf.writeInt16BE(vll.value, data.offset);

  const cga = toNumber(4, recordNumber, 8, record[8]);
  if (cga.tag === 'failure') {
    return failure(cga.error);
  }
  data.offset = data.buf.writeUInt8(cga.value, data.offset);

  data.offset += record[9].copy(data.buf, data.offset);

  return success(undefined);
};

const encodeNistInformationItem = (
  informationItem: NistInformationItem,
  data: EncodeTracking
): void => {
  if (informationItem) {
    if (typeof informationItem === 'string') {
      data.offset += data.buf.write(informationItem, data.offset); // utf-8 is the default
    } else {
      data.offset += informationItem.copy(data.buf, data.offset);
    }
  }
};

const encodeNistSubfield = (subfield: NistSubfield, data: EncodeTracking): void => {
  if (Array.isArray(subfield)) {
    subfield.forEach((informationItem, index, array) => {
      encodeNistInformationItem(informationItem, data);
      if (index < array.length - 1) {
        data.offset = data.buf.writeUInt8(SEPARATOR_UNIT, data.offset);
      }
    });
  } else {
    encodeNistInformationItem(subfield, data);
  }
};

const encodeNistField: NistFieldVisitorFn<EncodeTracking, NistFieldEncodeOptions> = ({
  field,
  data,
}): NistFieldVisitorFnReturn => {
  data.offset += data.buf.write(formatFieldKey(field.key.type, field.key.field), data.offset);
  data.offset = data.buf.writeUInt8(SEPARATOR_FIELD_NUMBER, data.offset);
  if (Array.isArray(field.value)) {
    field.value.forEach((subfield, index, array) => {
      encodeNistSubfield(subfield, data);
      if (index < array.length - 1) {
        data.offset = data.buf.writeUInt8(SEPARATOR_RECORD, data.offset);
      }
    });
  } else {
    encodeNistSubfield(field.value, data);
  }

  data.offset = data.buf.writeUInt8(SEPARATOR_GROUP, data.offset);

  return success(undefined);
};

const encodeNistRecord: NistRecordVisitorFn<EncodeTracking, NistFieldEncodeOptions> = (
  params
): Result<void, NistValidationError> => {
  const { data, recordTypeNumber, recordNumber, record } = params;

  if (recordTypeNumber === 4) {
    return encodeType4Record(record as NistType4Record, recordNumber, data);
  }

  const result = visitNistRecord(params);
  if (result.tag === 'failure') {
    return result;
  }
  // overwrite the last group separator
  data.offset = data.buf.writeUInt8(SEPARATOR_FILE, data.offset - 1);
  return success(undefined);
};

const encodeNistFile = ({
  nist,
  buf,
}: {
  nist: NistFile;
  buf: Buffer;
}): Result<void, NistValidationError> => {
  const encodeTracking = { buf, offset: 0 };
  return visitNistFile<EncodeTracking, NistFieldEncodeOptions, NistRecordEncodeOptions>({
    fieldVisitor: { fn: encodeNistField, data: encodeTracking },
    nist,
    recordVisitor: { fn: encodeNistRecord, data: encodeTracking },
    visitorStrategy: {},
  });
};

/* --------------------------- NIST file encoding ----------------------------------------------- */

/** Returns a new NistFile with defaults populated, formatters invoked and automatic fields computed. */
export interface NistPopulateSuccess {
  nist: NistFile;
  totalLength: number;
}
export const nistPopulate = (
  nistOrig: NistFile,
  options: NistEncodeOptions
): Result<NistPopulateSuccess, NistValidationError> => {
  // 1. copy of the NistFile structure only; values are not copied
  const nist = shallowCopyNistFile(nistOrig);

  // 2. provide defaults
  provideDefaults({ nist, codecOptions: options.codecOptions });

  // 3. invoke formatters
  invokeFormatters({ nist, options });

  // 4. determine if charset is UTF-8 or default 7-bit ASCII
  determineCharset({ nist });

  // 4. compute automatic fields: xx.002 (IDC), 1.003 and 1.015, xx.001
  const result = computeAutomaticFields({ nist });
  if (result.tag === 'failure') {
    return result;
  }

  return success({ nist, totalLength: result.value });
};

// :TODO: nistValidation + nistPopulate into a separate exported function

/** Encodes a NistFile structure into a Buffer. */
export const nistEncode = (
  nist: NistFile,
  options: NistEncodeOptions = {}
): Result<Buffer, NistValidationError | NistEncodeError> => {
  // 1. check for validity
  const result1 = nistValidation(nist, { ...options, checkForbiddenFields: true });
  if (result1.tag === 'failure') {
    return result1;
  }

  // 2. populate the NistFile
  const result2 = nistPopulate(nist, options);
  if (result2.tag === 'failure') {
    return result2;
  }
  const { nist: nistPopulated, totalLength } = result2.value;

  // 3. allocate buf
  let buf;
  try {
    buf = Buffer.allocUnsafe(totalLength);
  } catch (cause: unknown) {
    const detail = `Cannot allocate buffer of ${totalLength} bytes: limit is ${buffer.constants.MAX_LENGTH} bytes.`;
    return failure({ category: 'NIST', code: 'NIST_ENCODE_ERROR', detail, cause: cause as Error });
  }

  // 4. encode all fields into the buf (including arrays of subfields)
  const result3 = encodeNistFile({ nist: nistPopulated, buf });
  if (result3.tag === 'failure') {
    return result3;
  }
  return success(buf);
};
