import { randomFillSync } from 'crypto';
import fs from 'fs';
import { nistDecode, nistEncode, NistError, NistFile, NistType1Record } from './index';
import { nistPopulate, NistPopulateSuccess } from './nistEncode';
import { Failure, Success } from './result';
import { nistEncodeOptions } from './testNistEncoding';

const fsPromises = fs.promises;

const generateBinaryData = (length: number): Buffer => {
  const buffer = Buffer.alloc(length);
  randomFillSync(buffer);
  return buffer;
};

let fp1: Buffer;
let fp2: Buffer;
let fp3: Buffer;
beforeAll(async () => {
  fp1 = await fsPromises.readFile('./src/Fingerprint_LeftPointer.wsq');
  fp2 = await fsPromises.readFile('./src/Fingerprint_RightPointer.wsq');
  fp3 = await fsPromises.readFile('./src/Fingerprint_Latent.wsq');
});

describe('positive test:', () => {
  it('Type-1, Type-2, Type-4 with default options - populate only', () => {
    const nistInput: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      4: [
        {
          3: '0', // flat finger
          4: ['7'], // left index finger
          9: fp1,
        },
        {
          3: '0', // flat finger
          4: ['2'], // right index finger
          9: fp2,
        },
      ],
    };

    const result = nistPopulate(nistInput, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    const { nist, totalLength } = (result as Success<NistPopulateSuccess>).value;
    expect(totalLength).toBe(20296);
    expect(nist).toEqual({
      1: {
        1: '147',
        2: '0502',
        3: [
          ['1', '3'],
          ['2', '00'],
          ['4', '01'],
          ['4', '02'],
        ],
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '19.69',
        12: '19.69',
      },
      2: {
        1: '56',
        2: '00',
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      4: [
        {
          1: '9939',
          2: '01',
          3: '0',
          4: ['7'],
          5: '0',
          6: '500',
          7: '750',
          8: '1',
          9: fp1,
        },
        {
          1: '10154',
          2: '02',
          3: '0',
          4: ['2'],
          5: '0',
          6: '500',
          7: '750',
          8: '1',
          9: fp2,
        },
      ],
    });
  });

  it('Type-1 and Type-2 UTF-8 with default options - populate only', () => {
    const nistInput: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'Koloděj',
        5: 'Převor',
        7: '1978-05-12',
      },
    };

    const result = nistPopulate(nistInput, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    const { nist, totalLength } = (result as Success<NistPopulateSuccess>).value;
    expect(totalLength).toBe(215);
    expect(nist).toEqual({
      1: {
        1: '151',
        2: '0502',
        3: [
          ['1', '1'],
          ['2', '00'],
        ],
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
        15: [['3', 'UTF-8']],
      },
      2: {
        1: '64',
        2: '00',
        4: 'Koloděj',
        5: 'Převor',
        7: '1978-05-12',
      },
    });
  });

  it('Type-1 only - invoke formatter', () => {
    const nistInput: NistFile = {
      1: {
        2: '502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
    };

    const result = nistPopulate(nistInput, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    const { nist, totalLength } = (result as Success<NistPopulateSuccess>).value;
    expect(totalLength).toBe(132);
    expect(nist).toEqual({
      1: {
        1: '132',
        2: '0502',
        3: [['1', '0']],
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
    });
  });

  it('Type-1 only - invoke defaultValue', () => {
    const nistInput: NistFile = {
      1: {
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
    };

    const result = nistPopulate(nistInput, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    const { nist, totalLength } = (result as Success<NistPopulateSuccess>).value;
    expect(totalLength).toBe(132);
    expect(nist).toEqual({
      1: {
        1: '132',
        2: '0502',
        3: [['1', '0']],
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
    });
  });

  it('Type-1 only - do not invoke defaultValue (value is provided)', () => {
    const nistInput: NistFile = {
      1: {
        2: '0500',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
    };

    const result = nistPopulate(nistInput, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    const { nist, totalLength } = (result as Success<NistPopulateSuccess>).value;
    expect(totalLength).toBe(132);
    expect(nist).toEqual({
      1: {
        1: '132',
        2: '0500',
        3: [['1', '0']],
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
    });
  });

  it('Type-1 only - invoke per-TOT specific defaultValue', () => {
    const nistInput: NistFile = {
      1: {
        2: '0502',
        4: 'MAP',
        5: '20190930',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
    };

    const result = nistPopulate(nistInput, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    const { nist, totalLength } = (result as Success<NistPopulateSuccess>).value;
    expect(totalLength).toBe(140);
    expect(nist).toEqual({
      1: {
        1: '140',
        2: '0502',
        3: [['1', '0']],
        4: 'MAP',
        5: '20190930',
        6: '5',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
    });
  });

  it('NIST field 2.064 - invoke per-TOT mandatory function', () => {
    const nistInput: NistFile = {
      1: {
        2: '0502',
        4: 'SRE',
        5: '20190930',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054-2',
        10: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
        59: 'N', // no-hit => field 2.064 is optional
      },
    };

    const result = nistEncode(nistInput, nistEncodeOptions);
    expect(result.tag).toEqual('success');
  });

  it('Type-1 and Type-2 only with default options - encode into a Buffer', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    };

    const result = nistEncode(nist, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    expect((result as Success<Buffer>).value.byteLength).toBe(193);
    expect((result as Success<Buffer>).value).toMatchSnapshot();
    // await fsPromises.writeFile('type-1-2.tdf', (result as Success<Buffer>).value);

    // Providing no value for encode options should work as well.
    const result2 = nistEncode(nist);
    expect(result2.tag).toEqual('success');
  });

  it('Type-1, Type-2, Type-4 with default options - encode into a Buffer', () => {
    const nist: NistFile = {
      1: {
        2: '0300',
        4: 'IDN',
        5: '20190722',
        7: 'CABIS',
        8: 'MID00001',
        9: 'MBI20190722093422-IDE-00040',
      },
      2: {
        901: 'MID00001',
      },
      4: [
        {
          3: '0', // flat finger
          4: ['7'], // left index finger
          9: fp1,
        },
        {
          3: '0', // flat finger
          4: ['2'], // right index finger
          9: fp2,
        },
      ],
    };

    const result = nistEncode(nist, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    expect((result as Success<Buffer>).value.byteLength).toBe(20282);
    expect((result as Success<Buffer>).value).toMatchSnapshot();
    // await fsPromises.writeFile('type-1-2-4.tdf', (result as Success<Buffer>).value);
  });

  it('no encoding options - populate only', () => {
    const nistInput: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190930',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    };

    const result = nistPopulate(nistInput, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    const { nist, totalLength } = (result as Success<NistPopulateSuccess>).value;
    expect(totalLength).toBe(193);
    expect(nist).toEqual({
      1: {
        1: '137',
        2: '0502',
        3: [
          ['1', '1'],
          ['2', '00'],
        ],
        4: 'CRM',
        5: '20190930',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
      2: {
        1: '56',
        2: '00',
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    });
  });

  it('no encoding options - encode record type 1 + 2', () => {
    const nistInput: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190930',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    };

    const result = nistEncode(nistInput, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    expect((result as Success<Buffer>).value.byteLength).toBe(193);
    expect((result as Success<Buffer>).value).toMatchSnapshot();
  });

  it('Type-1, Type-2, Type-4 with an overflow for 2.001 (record length)', () => {
    const nist: NistFile = {
      1: {
        2: '0500',
        4: 'QS',
        5: '20191024',
        7: 'XXX',
        8: 'FIMB-SL-d',
        9: 'MBI-20191024T154641.244-QS',
        11: '19.69',
        12: '19.69',
      },
      2: {
        38: '20191024',
        88: 'any comment',
        408: 'userId',
        500: 'Y',
        501: 'Y',
        502: 'Y',
        905: 'CRIMINALCHECK',
      },
      4: [
        {
          3: '0', // flat finger
          4: ['1'], // right index finger
          5: '0', // 500 ppi
          6: '500', // horizontal line length
          7: '750', // vertical line length
          8: '1', // WSQ
          9: fp2,
        },
      ],
    };

    const encodeResult = nistEncode(nist, nistEncodeOptions);
    expect(encodeResult.tag).toEqual('success');
    const buffer = (encodeResult as Success<Buffer>).value;
    expect(buffer.byteLength).toBe(10411);
    expect(buffer).toMatchSnapshot();

    const decodeResult = nistDecode(buffer, {});
    expect(decodeResult.tag).toEqual('success');
  });

  it('Type-1, Type-2, Type-13 with default options - encode into a Buffer', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20191201',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      13: [
        {
          3: '4', // latent
          4: 'ORI38574354',
          5: '20191201',
          6: '500',
          7: '750',
          8: '1', // 1 = pixels per inch
          9: '500',
          10: '700',
          11: 'WSQ',
          12: '8',
          13: ['0'], // unknown finger
          999: fp1,
        },
      ],
    };

    const result = nistEncode(nist, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    expect((result as Success<Buffer>).value.byteLength).toBe(10277);
    expect((result as Success<Buffer>).value).toMatchSnapshot();
    // await fsPromises.writeFile('type-1-2-13.tdf', (result as Success<Buffer>).value);
  });

  it('Type-1, Type-2, Type-9, Type-13 with default options - encode into a Buffer', () => {
    const nist: NistFile = {
      1: {
        2: '0201',
        4: 'LFFS',
        5: '20200122',
        7: 'WVNGI0520',
        8: 'WVNGI0520',
        9: 'UCNRHMPXFAPV',
        11: '39.37',
        12: '39.37',
      },
      2: {
        6: 'FBI LATENT PRINT',
        10: [['UCN: RHMPXFAPV', 'BSI: 2000167243433']],
        11: '1111',
        74: '00',
        79: '20',
        83: 'Y',
        95: 'Y',
        98: '1',
      },
      9: [
        {
          3: '7',
          4: 'U',
          300: [['1971', '2873', '0', '0', '0,0-0,2873-1971,2873-1971,0']],
          301: [['0', '30']],
          // If the exact finger or palm position cannot be determined, multiple finger positions may be entered.
          302: [['01'], ['02'], ['03'], ['04'], ['05'], ['06'], ['07'], ['08'], ['09'], ['10']],
          331: [
            ['1015', '759', '174', 'E'],
            ['1003', '784', '343', 'E'],
            ['967', '962', '191', 'B'],
            ['1264', '1046', '129', 'B'],
            ['822', '1069', '11', 'B'],
            ['1241', '1201', '276', 'E'],
            ['657', '1284', '73', 'B'],
            ['1096', '1523', '264', 'E'],
            ['739', '2345', '17', 'E'],
            ['1086', '2381', '34', 'E'],
          ],
        },
      ],
      13: [
        {
          3: '0',
          4: 'WVNGI0520',
          5: '20200122',
          6: '777',
          7: '1132',
          8: '1',
          9: '1000',
          10: '1000',
          11: 'NONE',
          12: '8',
          13: ['18'],
          999: fp3,
        },
      ],
    };

    const result = nistEncode(nist, nistEncodeOptions);
    expect(result.tag).toEqual('success');
    expect((result as Success<Buffer>).value.byteLength).toBe(880293);
    expect((result as Success<Buffer>).value).toMatchSnapshot();
  });

  it('Type-1, Type-2 with alternative informationWriter', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20191201',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    };

    const result = nistEncode(nist, {
      ...nistEncodeOptions,
      codecOptions: {
        ...nistEncodeOptions.codecOptions,
        default: {
          2: {
            5: {
              informationWriter: (information) => {
                if (typeof information == 'string') return Buffer.from(information, 'latin1');
                return information;
              },
            },
          },
        },
      },
    });
    expect(result.tag).toEqual('success');
    expect((result as Success<Buffer>).value.byteLength).toBe(169);
    expect((result as Success<Buffer>).value).toMatchSnapshot();
  });
});

describe('negative test:', () => {
  it('Type-1 and Type-2 only - missing mandatory 1.004', () => {
    const type1: Partial<NistType1Record> = {
      2: '0502',
      5: '20190717',
      7: 'DAI035454',
      8: 'ORI38574354',
      9: 'TCN2487S054',
    };
    const nist: NistFile = {
      1: type1 as NistType1Record,
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 and Type-2 only - maxLength over for 1.002', () => {
    const nist: NistFile = {
      1: {
        2: '0502x',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 and Type-2 only - minLength failed for 1.002', () => {
    const nist: NistFile = {
      1: {
        2: '02',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 - regex failed for 1.002', () => {
    const nist: NistFile = {
      1: {
        2: '0x02',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 - regex failed for 1.005', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190x17',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 - regex failed for 1.006', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        6: '10',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 - regex failed for 1.011', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '3x5',
      },
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 - regex failed for 1.012', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        12: '5.12',
      },
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 - not 7-bit ASCII', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'překážky na dráze',
        9: 'TCN2487S054',
      },
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-4 - size over internal limit', () => {
    const binaryData = generateBinaryData(1 * 1024 * 1024 * 1024);

    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      4: [
        {
          3: '0', // flat finger
          4: ['7'], // left index finger
          9: binaryData,
        },
        {
          3: '0', // flat finger
          4: ['8'], // left middle finger
          9: binaryData,
        },
        {
          3: '0', // flat finger
          4: ['9'], // left ring finger
          9: binaryData,
        },
        {
          3: '0', // flat finger
          4: ['10'], // left little finger
          9: binaryData,
        },
      ],
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_ENCODE_ERROR');
    expect(failure.cause).toBeDefined();
    expect(failure.cause?.name).toEqual('RangeError');
    expect(failure.detail).toEqual(
      'Cannot allocate buffer of 4294967581 bytes: limit is 4294967296 bytes.',
    );
  });

  it('NIST field 4.003 is not numeric', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      4: [
        {
          3: 'aloha',
          4: ['7'], // left index finger
          9: generateBinaryData(1024),
        },
      ],
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 4.004 is not numeric', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      4: [
        {
          3: '0',
          4: ['7', 'aloha'],
          9: generateBinaryData(1024),
        },
      ],
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 4.005 is not numeric', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      4: [
        {
          3: '0',
          4: ['7', '0'],
          5: 'aloha',
          9: generateBinaryData(1024),
        },
      ],
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 4.006 is not numeric', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      4: [
        {
          3: '0',
          4: ['7', '0'],
          6: 'aloha',
          9: generateBinaryData(1024),
        },
      ],
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 4.007 is not numeric', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      4: [
        {
          3: '0',
          4: ['7', '0'],
          7: 'aloha',
          9: generateBinaryData(1024),
        },
      ],
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 4.008 is not numeric', () => {
    const nist: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190717',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
      4: [
        {
          3: '0',
          4: ['7', '0'],
          8: 'aloha',
          9: generateBinaryData(1024),
        },
      ],
    };
    const result = nistEncode(nist, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 1.001 (LEN) must not be provided', () => {
    const nistInput: NistFile = {
      1: {
        1: '137',
        2: '0502',
        4: 'CRM',
        5: '20190930',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
      2: {
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    };
    const result = nistEncode(nistInput, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 2.002 (IDC) must not be provided', () => {
    const nistInput: NistFile = {
      1: {
        2: '0502',
        4: 'CRM',
        5: '20190930',
        7: 'DAI035454',
        8: 'ORI38574354',
        9: 'TCN2487S054',
        11: '00.00',
        12: '00.00',
      },
      2: {
        2: '00',
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    };
    const result = nistEncode(nistInput, nistEncodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });
});
