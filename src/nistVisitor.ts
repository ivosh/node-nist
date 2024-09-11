// Ramda.deepMergeRight is currently used. This dependency could be removed in future.
import { mergeDeepRight } from 'ramda';

import {
  NistField,
  NistFieldCodecOptions,
  NistFieldValue,
  NistFile,
  NistFileCodecOptions,
  NistFileCodecOptionsPerTot,
  NistRecord,
  NistRecordCodecOptions,
} from './index';
import { NistValidationError } from './nistError';
import {
  formatFieldKey,
  NistFileInternal,
  nistRecordTypeNumbers,
  nistValidationError,
} from './nistUtils';
import { failure, Result, success } from './result';

interface NistVisitorStrategy {
  noStopOnErrors?: boolean;
  visitMissingFields?: boolean;
}

interface NistFieldVisitorParams<D, T extends NistFieldCodecOptions> {
  nist: NistFile;
  field: NistField;
  options?: T;
  data: D;
}

export type NistFieldVisitorFnReturn = Result<NistFieldValue, NistValidationError>;
export type NistFieldVisitorFn<D, T extends NistFieldCodecOptions> = (
  params: NistFieldVisitorParams<D, T>,
) => NistFieldVisitorFnReturn;
interface NistFieldVisitor<D, T extends NistFieldCodecOptions> {
  fn: NistFieldVisitorFn<D, T>;
  data: D;
}

interface VisitNistFieldParams<D, T extends NistFieldCodecOptions> {
  nist: NistFileInternal;
  record: NistRecord;
  key: {
    type: number;
    record: number;
    field: number;
  };
  value?: NistFieldValue;
  options?: T;
  fieldVisitor: NistFieldVisitor<D, T>;
}
const visitNistField = <D, T extends NistFieldCodecOptions>(
  params: VisitNistFieldParams<D, T>,
): NistFieldVisitorFnReturn => {
  const { nist, record, key, value, options, fieldVisitor } = params;
  const field = { key, value };
  const result = fieldVisitor.fn({
    data: fieldVisitor.data,
    field,
    nist: nist as unknown as NistFile,
    options,
  });

  if (result.tag === 'success' && result.value) {
    record[key.field] = result.value;
  }
  return result;
};

interface NistRecordVisitorParams<D, T extends NistFieldCodecOptions> {
  nist: NistFile;
  recordTypeNumber: number;
  record: NistRecord;
  recordNumber: number;
  options?: NistRecordCodecOptions<T>;
  visitorStrategy: NistVisitorStrategy;
  fieldVisitor: NistFieldVisitor<D, T>;
  data: D;
}

export type NistRecordVisitorFn<D, T extends NistFieldCodecOptions> = (
  params: NistRecordVisitorParams<D, T>,
) => Result<void, NistValidationError>;
interface NistRecordVisitor<D, T extends NistFieldCodecOptions> {
  fn: NistRecordVisitorFn<D, T>;
  data: D;
}

export const visitNistRecord = <D, T extends NistFieldCodecOptions>({
  nist,
  recordTypeNumber,
  record,
  recordNumber,
  visitorStrategy,
  options,
  fieldVisitor,
}: NistRecordVisitorParams<D, T>): Result<void, NistValidationError> => {
  let summaryResult: Result<void, NistValidationError> = success(undefined); // assume success

  const entries = Object.entries(record);
  if (visitorStrategy.visitMissingFields && options) {
    // Find fields which are missing in NIST file but we need to check mandatory or defaultValue.
    for (const key of Object.keys(options)) {
      const fieldNumber = parseInt(key, 10);
      if (isNaN(fieldNumber)) {
        return failure(
          nistValidationError(
            `NIST field number is not numeric for ${formatFieldKey(recordNumber, key)}`,
            { type: recordTypeNumber, record: recordNumber, field: 0 },
          ),
        );
      }
      if (!record[fieldNumber]) {
        entries.push([key, undefined]); // field is missing but we still need to visit it
      }
    }
  }

  for (const [key, value] of entries) {
    const fieldNumber = parseInt(key, 10);
    if (isNaN(fieldNumber)) {
      return failure(
        nistValidationError(
          `NIST field number is not numeric for ${formatFieldKey(recordNumber, key)}`,
          { type: recordTypeNumber, record: recordNumber, field: 0 },
        ),
      );
    }

    const result = visitNistField({
      fieldVisitor,
      key: { type: recordTypeNumber, record: recordNumber, field: fieldNumber },
      nist: nist as unknown as NistFileInternal,
      options: options && options[fieldNumber],
      record,
      value,
    });
    if (result.tag === 'failure') {
      if (visitorStrategy.noStopOnErrors) {
        summaryResult = result;
      } else {
        return result;
      }
    }
  }

  return summaryResult;
};

interface VisitNistRecordsParams<D, T extends NistFieldCodecOptions> {
  nist: NistFileInternal;
  recordTypeNumber: number;
  records: NistRecord | NistRecord[];
  options?: NistRecordCodecOptions<T>;
  visitorStrategy: NistVisitorStrategy;
  recordVisitor: NistRecordVisitor<D, T>;
  fieldVisitor: NistFieldVisitor<D, T>;
}
const visitNistRecords = <D, T extends NistFieldCodecOptions>({
  nist,
  recordTypeNumber,
  records,
  options,
  visitorStrategy,
  recordVisitor,
  fieldVisitor,
}: VisitNistRecordsParams<D, T>): Result<void, NistValidationError> => {
  let summaryResult: Result<void, NistValidationError> = success(undefined); // assume success

  if (Array.isArray(records)) {
    for (const [recordNumber, record] of records.entries()) {
      const result = recordVisitor.fn({
        data: recordVisitor.data,
        fieldVisitor,
        nist: nist as unknown as NistFile,
        options,
        record,
        recordNumber,
        recordTypeNumber,
        visitorStrategy,
      });
      if (result.tag === 'failure') {
        if (visitorStrategy.noStopOnErrors) {
          summaryResult = result;
        } else {
          return result;
        }
      }
    }
    return summaryResult;
  }
  return recordVisitor.fn({
    data: recordVisitor.data,
    fieldVisitor,
    nist: nist as unknown as NistFile,
    options,
    record: records,
    recordNumber: 1,
    recordTypeNumber,
    visitorStrategy,
  });
};

interface VisitNistFileParams<
  D,
  T extends NistFieldCodecOptions,
  U extends NistRecordCodecOptions<T>,
> {
  nist: NistFile;
  visitorStrategy: NistVisitorStrategy;
  options?: NistFileCodecOptions<T, U>;
  recordVisitor?: NistRecordVisitor<D, T>;
  fieldVisitor?: NistFieldVisitor<D, T>;
}

export const getPerTotOptions = <
  T extends NistFieldCodecOptions,
  U extends NistRecordCodecOptions<T>,
>(
  options: NistFileCodecOptions<T, U>,
  tot: string,
): NistFileCodecOptionsPerTot<T, U> =>
  mergeDeepRight(options.default, options[tot] || {}) as NistFileCodecOptionsPerTot<T, U>;

/* Visits the whole NistFile, all types, all records, all fields.
   recordVisitor and fieldVisitor can be overriden. */
export const visitNistFile = <
  D,
  T extends NistFieldCodecOptions,
  U extends NistRecordCodecOptions<T>,
>({
  nist,
  visitorStrategy,
  options,
  recordVisitor = { fn: visitNistRecord, data: undefined as unknown as D },
  fieldVisitor = { fn: () => success(undefined), data: undefined as unknown as D },
}: VisitNistFileParams<D, T, U>): Result<void, NistValidationError> => {
  const nistFile = nist as unknown as NistFileInternal;
  let summaryResult: Result<void, NistValidationError> = success(undefined); // assume success

  const perTotOptions = options && getPerTotOptions(options, nist[1][4]);

  for (const recordTypeNumber of nistRecordTypeNumbers) {
    if (nistFile[recordTypeNumber]) {
      const result = visitNistRecords<D, T>({
        fieldVisitor,
        nist: nistFile,
        options: perTotOptions && perTotOptions[recordTypeNumber],
        recordTypeNumber,
        recordVisitor,
        records: nistFile[recordTypeNumber],
        visitorStrategy,
      });
      if (result.tag === 'failure') {
        if (visitorStrategy.noStopOnErrors) {
          summaryResult = result;
        } else {
          return result;
        }
      }
    }
  }

  return summaryResult;
};

/* --------------------------- NIST file shallow copy ------------------------------------------- */

const shallowCopyNistFieldValue: NistFieldVisitorFn<NistFileInternal, NistFieldCodecOptions> = (
  params,
): NistFieldVisitorFnReturn => {
  const { nist, field, data: nistFileCopy } = params;
  const nistFile = nist as unknown as NistFileInternal;
  const { type: typeNumber, record: recordNumber, field: fieldNumber } = field.key;

  if (!nistFileCopy[typeNumber]) {
    nistFileCopy[typeNumber] = Array.isArray(nistFile[typeNumber]) ? [] : {};
  }
  const type = nistFileCopy[typeNumber];

  let record: NistRecord;
  if (Array.isArray(type)) {
    if (!type[recordNumber]) {
      type[recordNumber] = {};
    }
    record = type[recordNumber];
  } else {
    record = type;
  }

  record[fieldNumber] = Array.isArray(field.value) ? [...field.value] : field.value;
  return success(undefined);
};

/* Shallow copy of a NistFile. Clones the structure but not values. */
export const shallowCopyNistFile = (nist: NistFile): NistFile => {
  const copy: NistFileInternal = {};
  visitNistFile({
    fieldVisitor: { fn: shallowCopyNistFieldValue, data: copy },
    nist,
    visitorStrategy: {},
  });

  return copy as unknown as NistFile;
};
