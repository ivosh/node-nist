import { Failure, failure, Result, success } from './result';

export interface Dimensions {
  width: number;
  height: number;
}

export enum ResolutionUnits {
  NO_UNITS = 0,
  PIXELS_PER_INCH = 1,
  PIXELS_PER_CM = 2,
}

export interface Resolution {
  horizontal: number;
  vertical: number;
  units: ResolutionUnits;
}

export interface ImageHeader {
  type: ImageType;
  dimensions: Dimensions;
  resolution?: Resolution /* resolution is supported only for JPEG and PNG images */;
}

export interface ImageHeaderError {
  category: 'VALIDATION';
  code: 'IMAGE_HEADER';
  detail: string;
}

const truncatedError = (
  imageKind: string,
  segment: string | undefined,
  startOffset: number,
  shift: number,
  endOffset: number,
): Failure<ImageHeaderError> => {
  const message = `${imageKind} image seems to be truncated${segment ? ` for ${segment}` : ``}`;
  const numbers = `${startOffset.toString()} + ${shift.toString()} >= ${endOffset.toString()}`;
  return failure({
    category: 'VALIDATION',
    code: 'IMAGE_HEADER',
    detail: `${message}: ${numbers}`,
  });
};

const isJpegImage = (data: Buffer): Result<void, ImageHeaderError> => {
  if (data.length < 18) {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: 'JPEG data length is too small (less than 18 bytes).',
    });
  }

  if (data.readUInt16BE(0) !== 0xffd8) {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: 'JPEG image does not start with a start marker (SOI) ff d8.',
    });
  }

  if (data.readUInt16BE(2) !== 0xffe0) {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: 'JPEG image does not contain APP0 marker ff e0.',
    });
  }

  const identifier = data.toString(undefined, 6, 10);
  if (identifier !== 'JFIF') {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: "JPEG image does not contain 'JFIF' identifier in APP0 segment.",
    });
  }

  return success(undefined);
};

export const getJpegHeader = (data: Buffer): Result<ImageHeader, ImageHeaderError> => {
  const check = isJpegImage(data);
  if (check.tag === 'failure') {
    return check;
  }

  let offset = 2; // Skip start marker.

  const resolution = {
    horizontal: data.readUInt16BE(offset + 12),
    units: data[offset + 11],
    vertical: data.readUInt16BE(offset + 14),
  };

  do {
    if (data[offset] !== 0xff) {
      return failure({
        category: 'VALIDATION',
        code: 'IMAGE_HEADER',
        detail: 'JPEG segment does not start with a marker 0xff.',
      });
    }
    if (data[offset + 1] === 0xc0) {
      // Start of frame #0 (SOF0) marker: 0xffc0.
      if (offset + 8 >= data.length) {
        return truncatedError('JPEG', 'SOF0 segment', offset, 8, data.length);
      }
      return success({
        dimensions: { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) },
        resolution,
        type: 'JPEG',
      });
    }

    const segmentLength = data.readUInt16BE(offset + 2);
    if (segmentLength === 0) {
      return failure({
        category: 'VALIDATION',
        code: 'IMAGE_HEADER',
        detail: `JPEG segment contains segment length of 0 at offset ${offset.toString()}.`,
      });
    }
    offset += 2 + segmentLength; // Go to the next segment (skip segment marker as well).
  } while (offset < data.length);

  return failure({
    category: 'VALIDATION',
    code: 'IMAGE_HEADER',
    detail: 'JPEG image does not contain segment SOF0 with image dimensions.',
  });
};

const isJpeg2000Image = (data: Buffer): Result<void, ImageHeaderError> => {
  if (data.length < 8) {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: 'JPEG2000 data length is too small (less than 8 bytes).',
    });
  }

  const signature = data.toString(undefined, 4, 8);
  if (signature !== 'jP  ') {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: "JPEG2000 image does not contain 'jP  ' signature.",
    });
  }

  return success(undefined);
};

export const getJpeg2000Header = (data: Buffer): Result<ImageHeader, ImageHeaderError> => {
  const check = isJpeg2000Image(data);
  if (check.tag === 'failure') {
    return check;
  }

  let offset = 0;
  do {
    // Account also for segment type, not only segment length.
    if (offset + 8 >= data.length) {
      return truncatedError('JPEG2000', undefined, offset, 8, data.length);
    }

    if (data.toString(undefined, offset + 4, offset + 8) === 'jp2h') {
      // JPEG2000 header chunk (jp2h)
      if (offset + 24 >= data.length) {
        return truncatedError('JPEG2000', 'header segment', offset, 24, data.length);
      }
      return success({
        dimensions: {
          height: data.readUInt32BE(offset + 16),
          width: data.readUInt32BE(offset + 20),
        },
        type: 'JPEG2000',
      });
    }

    const segmentLength = data.readUInt32BE(offset);
    if (segmentLength === 0) {
      return failure({
        category: 'VALIDATION',
        code: 'IMAGE_HEADER',
        detail: `JPEG2000 segment contains segment length of 0 at offset ${offset.toString()}.`,
      });
    }
    offset += segmentLength; // Go to the next segment.
  } while (offset < data.length);

  return failure({
    category: 'VALIDATION',
    code: 'IMAGE_HEADER',
    detail: 'JPEG2000 image does not contain header segment with image dimensions.',
  });
};

const isWsqImage = (data: Buffer): Result<void, ImageHeaderError> => {
  if (data.length < 14) {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: 'WSQ data length is too small (less than 14 bytes).',
    });
  }

  if (data.readUInt16BE(0) !== 0xffa0) {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: 'WSQ image does not start with a start marker (SOI) ff a0.',
    });
  }

  if (data.readUInt16BE(data.length - 2) !== 0xffa1) {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: 'WSQ image does not end with an end marker (EOI) ff a1.',
    });
  }

  return success(undefined);
};

const parseComments = (input: string): Result<Map<string, string>, ImageHeaderError> => {
  const pairs = input.split('\n');
  if (pairs.length === 0) {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: 'WSQ comment segment does not contain any attributes.',
    });
  }

  const map = new Map<string, string>();
  pairs.forEach((pair) => {
    const keyValue = pair.split(' ');
    if (keyValue.length === 2) {
      map.set(keyValue[0], keyValue[1]);
    }
  });

  return success(map);
};

export const getWsqHeader = (data: Buffer): Result<ImageHeader, ImageHeaderError> => {
  const check = isWsqImage(data);
  if (check.tag === 'failure') {
    return check;
  }

  let offset = 2; // Skip start marker.

  let dimensions: Dimensions | undefined;
  let resolution: Resolution | undefined;

  do {
    if (data[offset] !== 0xff) {
      return failure({
        category: 'VALIDATION',
        code: 'IMAGE_HEADER',
        detail: 'WSQ segment does not start with a marker 0xff.',
      });
    }
    if (data[offset + 1] === 0xa2) {
      // Start of frame (SOF) marker: 0xffa2.
      if (offset + 10 >= data.length) {
        return truncatedError('WSQ', 'SOF segment', offset, 10, data.length);
      }

      dimensions = { height: data.readUInt16BE(offset + 6), width: data.readUInt16BE(offset + 8) };
    } else if (data[offset + 1] === 0xa8 && !resolution) {
      // Comment (COM) marker: 0xffa8.
      // We process this segment only when resolution has not been determined, yet.
      // Buggy implementations insert multiple COM segments (some of which are empty).
      if (offset + 11 >= data.length) {
        return truncatedError('WSQ', 'COM segment', offset, 11, data.length);
      }

      const segLength = data.readUInt16BE(offset + 2);
      const attributes = parseComments(
        data.toString(undefined, offset + 4, offset + segLength + 2),
      );
      if (attributes.tag === 'success') {
        if (!attributes.value.has('NIST_COM')) {
          return failure({
            category: 'VALIDATION',
            code: 'IMAGE_HEADER',
            detail: "WSQ comment segment does not contain 'NIST_COM' attribute.",
          });
        }

        if (attributes.value.has('PPI')) {
          const ppi = parseInt(attributes.value.get('PPI') ?? '', 10);
          if (isNaN(ppi)) {
            return failure({
              category: 'VALIDATION',
              code: 'IMAGE_HEADER',
              detail: "WSQ comment segment contains non-numeric 'PPI' attribute.",
            });
          }

          resolution = { horizontal: ppi, vertical: ppi, units: ResolutionUnits.PIXELS_PER_INCH };
        }
      }
    } else if (data[offset + 1] === 0xa1) {
      // End of image (EOI) marker does not have any segment.
      break;
    }

    if (dimensions && resolution) {
      break;
    }

    const segmentLength = data.readUInt16BE(offset + 2);
    if (segmentLength === 0) {
      return failure({
        category: 'VALIDATION',
        code: 'IMAGE_HEADER',
        detail: `WSQ segment contains segment length of 0 at offset ${offset.toString()}.`,
      });
    }
    offset += 2 + segmentLength; // Go to the next segment (skip segment marker as well).
  } while (offset < data.length);

  if (!dimensions) {
    return failure({
      category: 'VALIDATION',
      code: 'IMAGE_HEADER',
      detail: 'WSQ image does not contain segment SOF with image dimensions.',
    });
  }

  return success({ dimensions, resolution, type: 'WSQ' });
};

type ImageType = 'JPEG2000' | 'JPEG' | 'PNG' | 'WSQ';

export const getImageHeader = (data: Buffer): Result<ImageHeader, ImageHeaderError> => {
  let check = isJpegImage(data);
  if (check.tag === 'success') {
    const result = getJpegHeader(data);
    if (result.tag === 'success') {
      return result;
    }
  }

  check = isJpeg2000Image(data);
  if (check.tag === 'success') {
    const result = getJpeg2000Header(data);
    if (result.tag === 'success') {
      return result;
    }
  }

  check = isWsqImage(data);
  if (check.tag === 'success') {
    const result = getWsqHeader(data);
    if (result.tag === 'success') {
      return result;
    }
  }

  return failure({
    category: 'VALIDATION',
    code: 'IMAGE_HEADER',
    detail: 'Unable to determine image type.',
  });
};
