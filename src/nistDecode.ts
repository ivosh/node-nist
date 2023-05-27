import { inspect } from 'util';
import {
  NistCodecOptions,
  NistField,
  NistFieldCodecOptions,
  NistFieldKey,
  NistFieldValue,
  NistFile,
  NistFileCodecOptions,
  NistRecord,
  NistRecordCodecOptions,
  NistSubfield,
  NistType1Record,
  NistType4Record,
} from './index';
import { NistDecodeError, NistParseError, NistValidationError } from './nistError';
import {
  formatFieldKey,
  NistFileInternal,
  nistRecordTypeNumbers,
  provideDefaults,
  SEPARATOR_FIELD_NUMBER,
  SEPARATOR_FILE,
  SEPARATOR_GROUP,
  SEPARATOR_RECORD,
  SEPARATOR_UNIT,
} from './nistUtils';
import { nistValidation } from './nistValidation';
import { failure, Result, success } from './result';

/** Decoding options for a single NIST Field. */
export interface NistFieldDecodeOptions extends NistFieldCodecOptions {
  /** By default the following fields get decoded to a Buffer
   *  (instead of a NistFieldValue composed from a string or array of strings):
   * - 4.009 (DATA)
   * - 10.999 (DATA)
   *
   * This behaviour can be overridden on a per-field basis by passing a custom parser property.
   */
  parser?: (field: NistField, nist: NistFile) => Result<NistFieldValue, NistParseError>;
}

/** Decoding options for one NIST record. */
type NistRecordDecodeOptions = NistRecordCodecOptions<NistFieldDecodeOptions>;

/** Encoding options for a NIST file. */
type NistFileEncodeOptions = NistFileCodecOptions<NistFieldDecodeOptions, NistRecordDecodeOptions>;

export type NistDecodeOptions = NistCodecOptions<
  NistFieldDecodeOptions,
  NistRecordDecodeOptions,
  NistFileEncodeOptions
>;

const nistDecodeError = (
  detail: string,
  source?: { type: number; record: number; field: number; subField?: number },
  startOffset?: number,
  endOffset?: number
): NistDecodeError => ({
  category: 'NIST',
  code: 'NIST_DECODE_ERROR',
  detail,
  endOffset,
  nistSource: source,
  source:
    source &&
    `${source.type}/${source.record}/${source.field}${
      source.subField ? `/${source.subField}` : ''
    }`,
  startOffset,
});

const findSeparator = (
  buffer: Buffer,
  separator: string | number,
  startOffset: number,
  endOffset: number
): number | undefined => {
  const found = buffer.indexOf(separator, startOffset);
  return found >= startOffset && found <= endOffset ? found : undefined;
};

const findSeparators = (
  buffer: Buffer,
  separators: (string | number)[],
  startOffset: number,
  endOffset: number
): number | undefined => {
  const offsets = separators.map((separator) =>
    findSeparator(buffer, separator, startOffset, endOffset)
  );
  return offsets.reduce(
    (min, offset) => (min === undefined || (offset !== undefined && offset < min) ? offset : min),
    undefined
  );
};

/** Determines whether the key corresponds to a NIST field which contains repeating sets of information items;
 * and out of those items only one is mandatory and the rest is optional, such as field 9.302.
 * Decoding such a field value could be ambiguous without further hinting the decoder.
 */
const alwaysDecodeAsSet = (input: NistFieldKey): boolean => {
  const key = `${input.type}.${input.field}`;

  const keys: string[] = [
    '9.135',
    '9.302',
    '9.324',
    '9.354',
    '9.355',
    '9.356',
    '10.42',
    '10.48',
    '10.995',
    '10.997',
    '13.995',
    '13.997',
    '14.995',
    '14.997',
  ];
  return keys.includes(key);
};

const stringValue = (buffer: Buffer, startOffset: number, endOffset: number): string =>
  buffer.toString(undefined, startOffset, endOffset + 1);

const decodeNistSubfield = (
  key: NistFieldKey,
  buffer: Buffer,
  startOffset: number,
  endOffset: number
): NistSubfield => {
  let offset = startOffset;

  let unitSeparator = findSeparator(buffer, SEPARATOR_UNIT, offset, endOffset);
  if (unitSeparator) {
    let subfield: NistSubfield = [];
    while (offset <= endOffset) {
      subfield = [
        ...subfield,
        stringValue(buffer, offset, unitSeparator ? unitSeparator - 1 : endOffset),
      ];
      offset = (unitSeparator || endOffset) + 1;
      unitSeparator = findSeparator(buffer, SEPARATOR_UNIT, offset, endOffset);
    }
    return subfield;
  }

  // The same logic is present also in decodeNistFieldValue.
  if (alwaysDecodeAsSet(key)) {
    return [stringValue(buffer, startOffset, endOffset)];
  }
  return stringValue(buffer, startOffset, endOffset);
};

const decodeNistFieldValue = (
  key: NistFieldKey,
  buffer: Buffer,
  startOffset: number,
  endOffset: number
): NistFieldValue => {
  let offset = startOffset;

  let recordSeparator = findSeparator(buffer, SEPARATOR_RECORD, offset, endOffset);
  const unitSeparator = findSeparator(buffer, SEPARATOR_UNIT, offset, endOffset);

  if (!recordSeparator) {
    // Deal with the common case where there is just a single value in the whole field.
    if (!unitSeparator) {
      // The same logic is present also in decodeNistSubfield.
      if (alwaysDecodeAsSet(key)) {
        return [[stringValue(buffer, startOffset, endOffset)]];
      }
      return stringValue(buffer, startOffset, endOffset);
    }
    // Also deal with the case there is no record separator but some unit separators.
    return [decodeNistSubfield(key, buffer, startOffset, endOffset)];
  }

  let fieldValue: NistFieldValue = [];
  while (offset <= endOffset) {
    fieldValue = [
      ...fieldValue,
      decodeNistSubfield(key, buffer, offset, recordSeparator ? recordSeparator - 1 : endOffset),
    ];
    offset = (recordSeparator || endOffset) + 1;
    recordSeparator = findSeparator(buffer, SEPARATOR_RECORD, offset, endOffset);
  }

  return fieldValue;
};

interface DecodeNistFieldKeyResult {
  key: NistFieldKey;
  keyLength: number;
}
const decodeNistFieldKey = (
  buffer: Buffer,
  startOffset: number,
  endOffset: number,
  recordInstance: number
): Result<DecodeNistFieldKeyResult, NistDecodeError> => {
  const separatorOffset = findSeparator(buffer, SEPARATOR_FIELD_NUMBER, startOffset, endOffset);
  if (!separatorOffset) {
    const detail = `Cannot find NIST field number separator between offsets [${startOffset}, ${endOffset}]`;
    return failure(nistDecodeError(detail, undefined, startOffset, endOffset));
  }

  const fieldNumber = stringValue(buffer, startOffset, separatorOffset - 1);
  const match = fieldNumber.match(/^(\d+)\.(\d+)$/);
  if (!match) {
    const detail = `NIST field number '${fieldNumber}' at offset ${startOffset} does not have a correct format of 'x.yyy': ${inspect(
      fieldNumber,
      { depth: Infinity }
    )}.`;
    return failure(nistDecodeError(detail, undefined, startOffset, endOffset));
  }

  return success({
    key: { type: parseInt(match[1], 10), record: recordInstance, field: parseInt(match[2], 10) },
    keyLength: separatorOffset - startOffset + 1,
  });
};

const decodeRecordLength = (field: NistField): Result<number, NistDecodeError> => {
  if (!field.value) {
    const detail = `NIST field ${formatFieldKey(
      field.key.type,
      field.key.field
    )} (LEN) does not have any value.`;
    return failure(nistDecodeError(detail, field.key));
  }
  const lengthString = field.value.toString();
  const recordLength = parseInt(lengthString, 10);
  if (isNaN(recordLength)) {
    const detail = `NIST field ${formatFieldKey(
      field.key.type,
      field.key.field
    )} (LEN) does not have a numeric value: '${lengthString}'.`;
    return failure(nistDecodeError(detail, field.key));
  }

  if (recordLength <= 0) {
    const detail = `NIST field ${formatFieldKey(
      field.key.type,
      field.key.field
    )} (LEN) does not contain a positive number: ${lengthString}.`;
    return failure(nistDecodeError(detail, field.key));
  }

  return success(recordLength);
};

const decodeFgp = (buffer: Buffer): string[] => {
  const result = [];

  for (let index = 5; index >= 0; index -= 1) {
    const fgp = buffer[index];
    if (fgp === 255 && result.length === 0) {
      // Get rid of unused position at the end.
    } else {
      result.push(fgp === 255 ? '' : String(fgp));
    }
  }

  return result.reverse();
};

interface DecodeType4RecordResult {
  record: NistType4Record;
  recordLength: number;
}
const decodeType4Record = (
  buffer: Buffer,
  recordInstance: number,
  startOffset: number,
  endOffset: number
): Result<DecodeType4RecordResult, NistDecodeError> => {
  if (endOffset - startOffset < 18) {
    const detail = `NIST Type-4 record #${recordInstance} contains only ${
      endOffset - startOffset + 1
    } bytes but at least 18 bytes required.`;
    return failure(nistDecodeError(detail, undefined, startOffset, endOffset));
  }

  const length = buffer.readUInt32BE(startOffset + 0);
  const recordEndOffset = startOffset + length - 1;
  if (recordEndOffset > endOffset) {
    const detail = `NIST Type-4 record #${recordInstance}'s record length indicates ${length} bytes but only ${
      endOffset - startOffset + 1
    } available.`;
    return failure(
      nistDecodeError(detail, { type: 4, record: recordInstance, field: 1 }, startOffset, endOffset)
    );
  }
  const idc = buffer.readUInt8(startOffset + 4);
  const imp = buffer.readUInt8(startOffset + 5);
  const fgp = buffer.subarray(startOffset + 6, startOffset + 12);
  const isr = buffer.readUInt8(startOffset + 12);
  const hll = buffer.readInt16BE(startOffset + 13);
  const vll = buffer.readInt16BE(startOffset + 15);
  const cga = buffer.readUInt8(startOffset + 17);
  const data = buffer.subarray(startOffset + 18, recordEndOffset + 1);

  return success({
    record: {
      1: String(length),
      2: String(idc),
      3: String(imp),
      4: decodeFgp(fgp),
      5: String(isr),
      6: String(hll),
      7: String(vll),
      8: String(cga),
      9: data,
    },
    recordLength: length,
  });
};

export interface DecodeGenericRecordResult {
  record: NistRecord;
  recordLength: number;
}

/**
 * Decodes a generic (ASCII) NIST record. In general almost all NIST record types except 3-7.
 * @param buffer
 * @param recordType
 * @param recordInstance
 * @param startOffset offset of the record start
 * @param endOffset offset of the NIST file end
 */
export const decodeGenericNistRecord = (
  buffer: Buffer,
  recordType: number,
  recordInstance: number,
  startOffset: number,
  endOffset: number
): Result<DecodeGenericRecordResult, NistDecodeError> => {
  let offset = startOffset;
  let recordEndOffset: number | null = null; // This will be assigned after parsing LEN field.
  const nistRecord: NistRecord = {};
  let recordLength: Result<number, NistDecodeError> | null = null;

  while (offset < (recordEndOffset || endOffset)) {
    const separatorOffset = findSeparators(
      buffer,
      [SEPARATOR_FILE, SEPARATOR_GROUP],
      offset,
      recordEndOffset || endOffset
    );
    let fieldEndOffset = separatorOffset
      ? separatorOffset - 1
      : recordEndOffset
      ? recordEndOffset - 1
      : endOffset;

    const nistFieldKey = decodeNistFieldKey(buffer, offset, fieldEndOffset, recordInstance);
    if (nistFieldKey.tag === 'failure') {
      return nistFieldKey;
    }

    if (nistFieldKey.value.key.type !== recordType) {
      const detail = `NIST field ${formatFieldKey(
        nistFieldKey.value.key.type,
        nistFieldKey.value.key.field
      )} decoded at offset ${offset} contains an unexpected record type ${
        nistFieldKey.value.key.type
      }; expected ${recordType}.`;
      return failure(
        nistDecodeError(detail, nistFieldKey.value.key, offset, recordEndOffset || endOffset)
      );
    }

    const valueStartOffset = offset + nistFieldKey.value.keyLength;
    if (nistFieldKey.value.key.field === 999) {
      // Binary field x.999 is by definition always the last one and is delimited by record end.
      fieldEndOffset = recordEndOffset || endOffset;
    }

    const value =
      nistFieldKey.value.key.field === 999
        ? buffer.subarray(valueStartOffset, fieldEndOffset)
        : decodeNistFieldValue(nistFieldKey.value.key, buffer, valueStartOffset, fieldEndOffset);
    const nistField = { key: nistFieldKey.value.key, value };

    if (nistField.key.field === 1) {
      recordLength = decodeRecordLength(nistField);
      if (recordLength.tag === 'failure') {
        return recordLength;
      }
      recordEndOffset = startOffset + recordLength.value - 1;
      if (recordEndOffset > endOffset) {
        const detail = `Record length decoded from NIST field ${formatFieldKey(
          nistField.key.type,
          nistField.key.field
        )} indicates ${recordLength.value} bytes but only ${
          endOffset - startOffset + 1
        } available.`;
        return failure(nistDecodeError(detail, nistField.key, startOffset, recordEndOffset));
      }

      if (buffer[recordEndOffset] !== SEPARATOR_FILE) {
        const detail = `Cannot find NIST file separator between offsets [${startOffset}, ${recordEndOffset}].`;
        return failure(nistDecodeError(detail, undefined, startOffset, recordEndOffset));
      }
    }

    nistRecord[nistField.key.field] = nistField.value;
    offset = fieldEndOffset + 2;
  }

  if (!recordLength) {
    const detail = `Record ${recordType} does not contain NIST field ${formatFieldKey(
      recordType,
      1
    )} (LEN).`;
    const source = { type: recordType, record: recordInstance, field: 1 };
    return failure(nistDecodeError(detail, source, startOffset, recordEndOffset || endOffset));
  }

  // Note: recordLength includes file separator as well.
  return success({ record: nistRecord, recordLength: recordLength.value });
};

const addRecord = (
  nistFile: NistFileInternal,
  recordTypeNumber: number,
  nistRecord: NistRecord
): void => {
  if ([1, 2].includes(recordTypeNumber)) {
    nistFile[recordTypeNumber] = nistRecord;
  } else {
    if (!nistFile[recordTypeNumber]) {
      nistFile[recordTypeNumber] = [];
    }
    nistFile[recordTypeNumber] = [...(nistFile[recordTypeNumber] as NistRecord[]), nistRecord];
  }
};

const decodeNistFile = (buffer: Buffer): Result<NistFileInternal, NistDecodeError> => {
  let offset = 0;
  const endOffset = buffer.length - 1;

  const separatorOffset = findSeparator(buffer, SEPARATOR_FILE, offset, endOffset);
  if (!separatorOffset) {
    const detail = `Cannot find NIST file separator between offsets [${offset}, ${endOffset}].`;
    return failure(nistDecodeError(detail, undefined, offset, endOffset));
  }

  // 1. Decode Type-1 record. In particular we need parsed 1.003 (CNT).
  const type1RecordResult = decodeGenericNistRecord(buffer, 1, 1, offset, separatorOffset);
  if (type1RecordResult.tag === 'failure') {
    return type1RecordResult;
  }
  const type1Record = type1RecordResult.value.record as unknown as NistType1Record;

  if (!type1Record[3]) {
    const detail = `NIST field 1.003 (CNT) was not found between offsets [${offset}, ${endOffset}].`;
    return failure(nistDecodeError(detail, undefined, offset, endOffset));
  }
  if (!Array.isArray(type1Record[3]) || type1Record[3].length < 1) {
    const detail = `NIST field 1.003 (CNT) does not have a correct format: ${inspect(
      type1Record[3],
      { depth: Infinity }
    )}.`;
    return failure(nistDecodeError(detail, { type: 1, record: 1, field: 3 }, offset, endOffset));
  }

  const nistFile: NistFileInternal = { 1: type1Record };
  offset = separatorOffset + 1;

  // 2. Decode all the remaining records in the order given by 1.003 (CNT).
  for (let recordIndex = 1; recordIndex < type1Record[3].length; recordIndex += 1) {
    const recordInfo = type1Record[3][recordIndex];
    if (!recordInfo || !Array.isArray(recordInfo) || recordInfo.length !== 2) {
      const detail = `NIST subfield 1.003.${recordIndex} does not have a correct format: ${inspect(
        type1Record[3],
        { depth: Infinity }
      )}.`;
      return failure(
        nistDecodeError(
          detail,
          { type: 1, record: 1, field: 3, subField: recordIndex },
          offset,
          endOffset
        )
      );
    }

    const [recordType] = recordInfo;
    const recordTypeNumber = parseInt(recordType, 10);
    if (isNaN(recordTypeNumber)) {
      const detail = `NIST subfield 1.003.${recordIndex} does not contain numeric value: ${inspect(
        type1Record[3],
        { depth: Infinity }
      )}.`;
      return failure(
        nistDecodeError(
          detail,
          { type: 1, record: 1, field: 3, subField: recordIndex },
          offset,
          endOffset
        )
      );
    }

    if (recordTypeNumber === 1) {
      const detail = `NIST field 1.003 indicates two Type-1 records: ${inspect(type1Record[3], {
        depth: Infinity,
      })}.`;
      return failure(
        nistDecodeError(
          detail,
          { type: 1, record: 1, field: 3, subField: recordIndex },
          offset,
          endOffset
        )
      );
    }
    if (recordTypeNumber === 2 && nistFile[2]) {
      const detail = 'More than one Type-2 NIST record in one NIST file is unsupported.';
      return failure(nistDecodeError(detail, undefined, offset, endOffset));
    }
    if (!nistRecordTypeNumbers.includes(recordTypeNumber)) {
      const detail = `NIST record Type-${recordTypeNumber} is unsupported.`;
      return failure(nistDecodeError(detail, undefined, offset, endOffset));
    }

    if (recordTypeNumber === 4) {
      const decodeResult = decodeType4Record(
        buffer,
        nistFile[4] ? (nistFile[4] as NistType4Record[]).length : 1,
        offset,
        endOffset
      );
      if (decodeResult.tag === 'failure') {
        return decodeResult;
      }

      addRecord(nistFile, recordTypeNumber, decodeResult.value.record);
      offset += decodeResult.value.recordLength;
    } else {
      const decodeResult = decodeGenericNistRecord(
        buffer,
        recordTypeNumber,
        [1, 2].includes(recordTypeNumber) || !nistFile[recordTypeNumber]
          ? 1
          : (nistFile[recordTypeNumber] as NistRecord[]).length,
        offset,
        endOffset
      );
      if (decodeResult.tag === 'failure') {
        return decodeResult;
      }

      addRecord(nistFile, recordTypeNumber, decodeResult.value.record);
      // Note: record length includes file separator as well.
      offset += decodeResult.value.recordLength;
    }
  }

  return success(nistFile);
};

/** Decodes a Buffer into a NistFile structure. */
export const nistDecode = (
  buffer: Buffer,
  options: NistDecodeOptions = {}
): Result<NistFile, NistDecodeError | NistValidationError> => {
  // 1. Decode the buffer.
  const nistFileInternal = decodeNistFile(buffer);
  if (nistFileInternal.tag === 'failure') {
    return nistFileInternal;
  }
  const nistFile = nistFileInternal.value as unknown as NistFile;

  // 2. Validate the decoded object.
  const result = nistValidation(nistFile, { ...options, checkForbiddenFields: false });
  if (result.tag === 'failure') {
    return result;
  }

  // 3. Provide defaults.
  provideDefaults({ nist: nistFile, codecOptions: options.codecOptions });

  return success(nistFile);
};
