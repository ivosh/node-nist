import {
  NistFieldCodecOptions,
  NistFile,
  NistFileCodecOptions,
  NistRecord,
  NistRecordCodecOptions
} from './index';
import { NistValidationError } from './nistError';
import { NistFieldVisitorFn, NistFieldVisitorFnReturn, visitNistFile } from './nistVisitor';
import { Result, success } from './result';

export const formatFieldKey = (typeNumber: number | string, fieldNumber: number | string): string =>
  `${typeNumber}.${String(fieldNumber).padStart(3, '0')}`;

/** Currently supported NIST record Type-x numbers; at least for now. */
export const nistRecordTypeNumbers = [1, 2, 4, 10, 13, 14];

export const nistValidationError = (
  detail: string,
  source: { type: number; record: number; field: number }
): NistValidationError => ({
  category: 'NIST',
  code: 'NIST_VALIDATION_ERROR',
  detail,
  nistSource: source,
  source: `${source.type}/${source.record}/${source.field}`
});

/* Used only internally to index into all NIST record types. */
export interface NistFileInternal {
  [key: number]: NistRecord | NistRecord[];
}

export const SEPARATOR_FILE = 0x1c; // separates records within a NIST file
export const SEPARATOR_GROUP = 0x1d; // separates fields within a record
export const SEPARATOR_RECORD = 0x1e; // separates repeated subfields within a record
export const SEPARATOR_UNIT = 0x1f; // separates information items within a subfield
export const SEPARATOR_FIELD_NUMBER = 0x3a; // separates field number from field value

const defaultValueForNistField: NistFieldVisitorFn<
  void,
  { defaultValue?: NistFieldCodecOptions['defaultValue'] }
> = (params): NistFieldVisitorFnReturn => {
  const { field, nist, options } = params;
  if (!field.value && options && options.defaultValue) {
    const defaultValue =
      typeof options.defaultValue === 'function'
        ? options.defaultValue(field, nist)
        : options.defaultValue;
    return success(defaultValue);
  }
  return success(undefined);
};

export const provideDefaults = ({
  nist,
  codecOptions
}: {
  nist: NistFile;
  codecOptions: NistFileCodecOptions<{}, {}> | undefined;
}): Result<void, NistValidationError> => {
  visitNistFile<void, NistFieldCodecOptions, NistRecordCodecOptions<{}>>({
    fieldVisitor: { fn: defaultValueForNistField, data: undefined },
    nist,
    options: codecOptions,
    visitorStrategy: { visitMissingFields: true }
  });

  return success(undefined);
};
