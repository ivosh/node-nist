import fs from 'fs';
import {
  getImageHeader,
  getJpeg2000Header,
  getJpegHeader,
  getWsqHeader,
  ImageHeader,
  ImageHeaderError,
  ResolutionUnits,
} from './imageHeader';
import { Failure, Success } from './result';

const fsPromises = fs.promises;

let jpeg: Buffer;
let jp2: Buffer;
let wsq: Buffer;
beforeAll(async () => {
  jpeg = await fsPromises.readFile('./src/imageHeader_test.jpeg');
  jp2 = await fsPromises.readFile('./src/imageHeader_test.jp2');
  wsq = await fsPromises.readFile('./src/imageHeader_test.wsq');
});

describe('JPEG image header:', () => {
  it('real JPEG image', () => {
    const result = getJpegHeader(jpeg);

    expect(result.tag).toEqual('success');
    expect((result as Success<ImageHeader>).value).toEqual({
      dimensions: { width: 400, height: 533 },
      resolution: { horizontal: 150, vertical: 150, units: ResolutionUnits.PIXELS_PER_INCH },
      type: 'JPEG',
    });
  });

  it('minimalist JPEG image', () => {
    const result = getJpegHeader(
      Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x0e, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x01, 0x01,
        0xf4, 0x01, 0xf4, 0xff, 0xc0, 0x00, 0x05, 0x00, 0x01, 0x40, 0x01, 0xe0,
      ]),
    );

    expect(result.tag).toEqual('success');
    expect((result as Success<ImageHeader>).value).toEqual({
      dimensions: { width: 480, height: 320 },
      resolution: { horizontal: 500, vertical: 500, units: ResolutionUnits.PIXELS_PER_INCH },
      type: 'JPEG',
    });
  });

  it('JPEG data too small', () => {
    const result = getJpegHeader(Buffer.from([0x01]));

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('JPEG image does not start with SOI', () => {
    const result = getJpegHeader(
      Buffer.from([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10, 0x11, 0x12,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('JPEG image does not contain APP0 segment', () => {
    const result = getJpegHeader(
      Buffer.from([
        0xff, 0xd8, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10, 0x11, 0x12,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('JPEG APP0 segment does not contain JFIF identifier', () => {
    const result = getJpegHeader(
      Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10, 0x11, 0x12,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('segment length exceeds total length', () => {
    const result = getJpegHeader(
      Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0xaa, 0xbb, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f, 0x10, 0x11, 0x12,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('segment does not start with a marker', () => {
    const result = getJpegHeader(
      Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46, 0xbb, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('truncated SOF0 segment', () => {
    const result = getJpegHeader(
      Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x07, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xc0, 0x00, 0x00,
        0xee, 0x00, 0x00,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('no SOF0 segment', () => {
    const result = getJpegHeader(
      Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x07, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xc1, 0x00, 0x05,
        0x00, 0x00, 0x00,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('segment length 0', () => {
    const result = getJpegHeader(
      Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x07, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xc1, 0x00, 0x00,
        0xff, 0xff, 0xff,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });
});

describe('JPEG2000 image header:', () => {
  it('real JPEG2000 image', () => {
    const result = getJpeg2000Header(jp2);

    expect(result.tag).toEqual('success');
    expect((result as Success<ImageHeader>).value).toEqual({
      dimensions: { width: 240, height: 320 },
      type: 'JPEG2000',
    });
  });

  it('minimalist JPEG2000 image', () => {
    const result = getJpeg2000Header(
      Buffer.from([
        0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a, 0x00, 0x00, 0x00,
        0x18, 0x6a, 0x70, 0x32, 0x68, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x40, 0x00, 0x00, 0x01, 0xe0, 0x00,
      ]),
    );

    expect(result.tag).toEqual('success');
    expect((result as Success<ImageHeader>).value).toEqual({
      dimensions: { width: 480, height: 320 },
      type: 'JPEG2000',
    });
  });

  it('JPEG2000 data too small', () => {
    const result = getJpeg2000Header(Buffer.from([0x01]));

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('JPEG2000 image does not start with "jP  "', () => {
    const result = getJpeg2000Header(
      Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('segment length exceeds total length', () => {
    const result = getJpeg2000Header(
      Buffer.from([
        0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a, 0xaa, 0xbb, 0xcc,
        0xdd, 0x66, 0x74, 0x79, 0x70,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('truncated jp2h segment', () => {
    const result = getJpeg2000Header(
      Buffer.from([
        0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a, 0x00, 0x00, 0x00,
        0x0a, 0x6a, 0x70, 0x32, 0x68, 0x00,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('no jp2h segment', () => {
    const result = getJpeg2000Header(
      Buffer.from([
        0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a, 0x00, 0x00, 0x00,
        0x09, 0x6a, 0x70, 0x31, 0x68, 0x00,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('segment length of 0', () => {
    const result = getJpeg2000Header(
      Buffer.from([
        0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a, 0x00, 0x00, 0x00,
        0x00, 0x6a, 0x70, 0x31, 0x68, 0x00, 0x00, 0x00, 0x0a,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });
});

describe('image types:', () => {
  it('determine JPEG image', () => {
    const result = getImageHeader(jpeg);

    expect(result.tag).toEqual('success');
    expect((result as Success<ImageHeader>).value).toEqual({
      dimensions: { width: 400, height: 533 },
      resolution: { horizontal: 150, vertical: 150, units: ResolutionUnits.PIXELS_PER_INCH },
      type: 'JPEG',
    });
  });

  it('determine JPEG2000 image', () => {
    const result = getImageHeader(jp2);

    expect(result.tag).toEqual('success');
    expect((result as Success<ImageHeader>).value).toEqual({
      dimensions: { width: 240, height: 320 },
      type: 'JPEG2000',
    });
  });

  it('determine nothing', () => {
    const result = getImageHeader(Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });
});

describe('WSQ image header:', () => {
  it('real WSQ image', () => {
    const result = getWsqHeader(wsq);

    expect(result.tag).toEqual('success');
    expect((result as Success<ImageHeader>).value).toEqual({
      dimensions: { width: 320, height: 480 },
      resolution: { horizontal: 500, vertical: 500, units: ResolutionUnits.PIXELS_PER_INCH },
      type: 'WSQ',
    });
  });

  it('minimalist WSQ image', () => {
    const result = getWsqHeader(
      Buffer.from([
        0xff, 0xa0, 0xff, 0xa8, 0x00, 0x14, 0x4e, 0x49, 0x53, 0x54, 0x5f, 0x43, 0x4f, 0x4d, 0x20,
        0x32, 0x0a, 0x50, 0x50, 0x49, 0x20, 0x35, 0x30, 0x30, 0xff, 0xa2, 0x00, 0x08, 0x00, 0xff,
        0x01, 0xe0, 0x01, 0x40, 0xff, 0xa1,
      ]),
    );

    expect(result.tag).toEqual('success');
    expect((result as Success<ImageHeader>).value).toEqual({
      dimensions: { width: 320, height: 480 },
      resolution: { horizontal: 500, vertical: 500, units: ResolutionUnits.PIXELS_PER_INCH },
      type: 'WSQ',
    });
  });

  it('WSQ data too small', () => {
    const result = getWsqHeader(Buffer.from([0x01]));

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('WSQ image does not start with SOI', () => {
    const result = getWsqHeader(
      Buffer.from([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10, 0x11, 0x12,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('segment length exceeds total length', () => {
    const result = getWsqHeader(
      Buffer.from([
        0xff, 0xa0, 0xff, 0xa3, 0xaa, 0xbb, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f, 0x10, 0x11, 0x12, 0xff, 0xa1,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('segment does not start with a marker', () => {
    const result = getWsqHeader(
      Buffer.from([
        0xff, 0xa0, 0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46, 0xbb, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0xff, 0xa1,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('truncated SOF segment', () => {
    const result = getWsqHeader(
      Buffer.from([
        0xff, 0xa0, 0xff, 0xa3, 0x00, 0x07, 0x03, 0x04, 0x05, 0x06, 0x07, 0xff, 0xa2, 0x00, 0x00,
        0xee, 0x00, 0x00, 0xff, 0xa1,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('no SOF segment', () => {
    const result = getWsqHeader(
      Buffer.from([
        0xff, 0xa0, 0xff, 0xe0, 0x00, 0x07, 0x03, 0x04, 0x05, 0x06, 0x07, 0xff, 0xc1, 0x00, 0x05,
        0x00, 0x00, 0x00, 0xff, 0xa1,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('segment length 0', () => {
    const result = getWsqHeader(
      Buffer.from([
        0xff, 0xa0, 0xff, 0xe0, 0x00, 0x07, 0x03, 0x04, 0x05, 0x06, 0x07, 0xff, 0xc1, 0x00, 0x00,
        0xff, 0xff, 0xff, 0xff, 0xa1,
      ]),
    );

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<ImageHeaderError>).error;
    expect(failure.category).toEqual('VALIDATION');
    expect(failure.code).toEqual('IMAGE_HEADER');
    expect(failure).toMatchSnapshot();
  });

  it('WSQ image contains two COM segments (second is empty)', () => {
    const result = getWsqHeader(
      Buffer.from([
        0xff, 0xa0, 0xff, 0xa8, 0x00, 0x14, 0x4e, 0x49, 0x53, 0x54, 0x5f, 0x43, 0x4f, 0x4d, 0x20,
        0x32, 0x0a, 0x50, 0x50, 0x49, 0x20, 0x35, 0x30, 0x30, 0xff, 0xa8, 0x00, 0x02, 0xff, 0xa2,
        0x00, 0x08, 0x00, 0xff, 0x01, 0xe0, 0x01, 0x40, 0xff, 0xa1,
      ]),
    );

    expect(result.tag).toEqual('success');
    expect((result as Success<ImageHeader>).value).toEqual({
      dimensions: { width: 320, height: 480 },
      resolution: { horizontal: 500, vertical: 500, units: ResolutionUnits.PIXELS_PER_INCH },
      type: 'WSQ',
    });
  });
});
