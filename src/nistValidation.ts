import {
  NistCodecOptions,
  NistFieldCodecOptions,
  NistFile,
  NistFileCodecOptions,
  NistInformationItem,
  NistRecordCodecOptions,
} from './index';
import { formatFieldKey, nistValidationError } from './nistUtils';
import {
  NistFieldVisitorFn,
  NistFieldVisitorFnReturn,
  visitNistFile,
  visitNistRecord,
} from './nistVisitor';
import { match, success } from './result';

const checkMandatory: NistFieldVisitorFn<void, NistFieldCodecOptions> = (
  params
): NistFieldVisitorFnReturn => {
  const { nist, field, options } = params;
  if (options && options.mandatory) {
    const mandatory =
      typeof options.mandatory === 'boolean' ? options.mandatory : options.mandatory(field, nist);
    const isValueRequired = mandatory && !options.defaultValue;
    return match(
      isValueRequired ? !!field.value : true,
      undefined,
      nistValidationError(
        `Field ${formatFieldKey(field.key.type, field.key.field)} is mandatory but not provided`,
        field.key
      )
    );
  }
  return success(undefined);
};

const checkMaxLength: NistFieldVisitorFn<void, NistFieldCodecOptions> = (
  params
): NistFieldVisitorFnReturn => {
  const { nist, field, options } = params;
  if (options && options.maxLength) {
    const maxLength =
      typeof options.maxLength === 'number' ? options.maxLength : options.maxLength(field, nist);
    return match(
      !!(field.value && field.value.length <= maxLength),
      undefined,
      nistValidationError(
        `Field ${formatFieldKey(
          field.key.type,
          field.key.field
        )} exceeds maximum length of ${maxLength}`,
        field.key
      )
    );
  }
  return success(undefined);
};

const checkMinLength: NistFieldVisitorFn<void, NistFieldCodecOptions> = (
  params
): NistFieldVisitorFnReturn => {
  const { nist, field, options } = params;
  if (options && options.minLength) {
    const minLength =
      typeof options.minLength === 'number' ? options.minLength : options.minLength(field, nist);
    return match(
      !!(field.value && field.value.length >= minLength),
      undefined,
      nistValidationError(
        `Field ${formatFieldKey(
          field.key.type,
          field.key.field
        )} does not meet minimal length of ${minLength}`,
        field.key
      )
    );
  }
  return success(undefined);
};

const checkRegexs: NistFieldVisitorFn<void, NistFieldCodecOptions> = (
  params
): NistFieldVisitorFnReturn => {
  const { nist, field, options } = params;
  if (options && options.regexs) {
    for (const item of options.regexs) {
      const regex = typeof item === 'object' ? item : item(field, nist);
      return match(
        !!(typeof field.value === 'string' && RegExp(regex.regex).test(field.value)),
        undefined,
        nistValidationError(
          `${regex.errMsg} for field ${formatFieldKey(field.key.type, field.key.field)}`,
          field.key
        )
      );
    }
  }
  return success(undefined);
};

const is7bitAscii = (input: NistInformationItem): boolean =>
  typeof input === 'string' ? /^[\x20-\x7e]*$/.test(input) : true;
export const check7bitAscii: NistFieldVisitorFn<void, NistFieldCodecOptions> = (
  params
): NistFieldVisitorFnReturn => {
  const { field } = params;
  return match(
    Array.isArray(field.value)
      ? field.value.every((subfield) =>
          Array.isArray(subfield)
            ? subfield.every((input) => is7bitAscii(input))
            : is7bitAscii(subfield)
        )
      : is7bitAscii(field.value),
    undefined,
    nistValidationError(
      `Field ${formatFieldKey(field.key.type, field.key.field)} is not 7-bit ASCII`,
      field.key
    )
  );
};

const checkForbiddenRecordLengthField: NistFieldVisitorFn<void, NistFieldCodecOptions> = ({
  field,
}): NistFieldVisitorFnReturn => {
  return match(
    field.key.field !== 1,
    undefined,
    nistValidationError(
      `Field ${formatFieldKey(field.key.type, field.key.field)} (LEN) must not be provided`,
      field.key
    )
  );
};

const checkForbiddenIdcField: NistFieldVisitorFn<void, NistFieldCodecOptions> = ({
  field,
}): NistFieldVisitorFnReturn => {
  return match(
    field.key.field !== 2 || field.key.type === 1,
    undefined,
    nistValidationError(
      `Field ${formatFieldKey(field.key.type, field.key.field)} (IDC) must not be provided`,
      field.key
    )
  );
};

/* Checks a NistFile for validity. */
export const nistValidation = <
  T extends NistFieldCodecOptions,
  U extends NistRecordCodecOptions<T>,
  V extends NistFileCodecOptions<T, U>
>(
  nist: NistFile,
  options: NistCodecOptions<T, U, V> & { checkForbiddenFields: boolean }
): NistFieldVisitorFnReturn => {
  // 1. check mandatory (visit also fields which are missing)
  let result = visitNistFile<void, T, U>({
    fieldVisitor: { fn: checkMandatory, data: undefined },
    nist,
    options: options && options.codecOptions,
    visitorStrategy: { visitMissingFields: true },
  });
  if (result.tag === 'failure' && !options.ignoreMissingMandatoryFields) {
    return result;
  }

  // 2. check maxLength
  result = visitNistFile<void, T, U>({
    fieldVisitor: { fn: checkMaxLength, data: undefined },
    nist,
    options: options && options.codecOptions,
    visitorStrategy: {},
  });
  if (result.tag === 'failure' && !options.ignoreValidationChecks) {
    return result;
  }

  // 3. check minLength
  result = visitNistFile<void, T, U>({
    fieldVisitor: { fn: checkMinLength, data: undefined },
    nist,
    options: options && options.codecOptions,
    visitorStrategy: {},
  });
  if (result.tag === 'failure' && !options.ignoreValidationChecks) {
    return result;
  }

  // 4. check regexs
  result = visitNistFile<void, T, U>({
    fieldVisitor: { fn: checkRegexs, data: undefined },
    nist,
    options: options && options.codecOptions,
    visitorStrategy: {},
  });
  if (result.tag === 'failure' && !options.ignoreValidationChecks) {
    return result;
  }

  // 5. check validation rules
  // :TODO:

  // 6. check 7-bit ASCII for all Type-1 fields
  result = visitNistRecord<void, T>({
    data: undefined,
    fieldVisitor: { fn: check7bitAscii, data: undefined },
    nist,
    record: nist[1],
    recordNumber: 1,
    recordTypeNumber: 1,
    visitorStrategy: {},
  });
  if (result.tag === 'failure' && !options.ignoreValidationChecks) {
    return result;
  }

  // 7. NIST fields xx.001 (record length) must not be provided.
  if (options.checkForbiddenFields) {
    result = visitNistFile<void, T, U>({
      fieldVisitor: { fn: checkForbiddenRecordLengthField, data: undefined },
      nist,
      options: options && options.codecOptions,
      visitorStrategy: {},
    });
    if (result.tag === 'failure') {
      return result; // Forbidden LEN fields must not be provided; no override.
    }
  }

  // 8. NIST fields xx.002 (IDC) must not be provided.
  if (options.checkForbiddenFields) {
    result = visitNistFile<void, T, U>({
      fieldVisitor: { fn: checkForbiddenIdcField, data: undefined },
      nist,
      options: options && options.codecOptions,
      visitorStrategy: {},
    });
    if (result.tag === 'failure') {
      return result; // Forbidden IDC fields must not be provided; no override.
    }
  }

  // 9. 1.003 field must not be provided
  // :TODO:

  return success(undefined);
};
