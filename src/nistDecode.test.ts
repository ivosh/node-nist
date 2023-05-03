import fs from 'fs';
import { nistDecode, nistEncode, NistError, NistFile, NistType9Record } from './index';
import { decodeGenericNistRecord, DecodeGenericRecordResult } from './nistDecode';
import { Failure, Success } from './result';
import { nistDecodeOptions } from './testNistDecoding';

const fsPromises = fs.promises;

let fp1: Buffer;
let fp2: Buffer;
let sreWithFace: Buffer;
let latentMinutiae: Buffer;
beforeAll(async () => {
  fp1 = await fsPromises.readFile('./src/Fingerprint_LeftPointer.wsq');
  fp2 = await fsPromises.readFile('./src/Fingerprint_RightPointer.wsq');
  sreWithFace = await fsPromises.readFile('./src/sre_with_face.tdf');
  latentMinutiae = await fsPromises.readFile('./src/latent_with_minutiae.lffs');
});

describe('positive test:', () => {
  it('decode Type-1 record containing field 1.001 (LEN) at offset 0', () => {
    const buffer = Buffer.concat([Buffer.from('1.001:8'), Buffer.from([28])]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('success');
    expect((result as Success<DecodeGenericRecordResult>).value).toEqual({
      record: { 1: '8' },
      recordLength: 8,
    });
  });

  it('decode Type-1 record containing field 1.001 (LEN) at offset 5', () => {
    const buffer = Buffer.concat([
      Buffer.from([0, 1, 2, 3, 4]),
      Buffer.from('1.001:8'),
      Buffer.from([28]),
    ]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 5, buffer.length - 1);

    expect(result.tag).toEqual('success');
    expect((result as Success<DecodeGenericRecordResult>).value).toEqual({
      record: { 1: '8' },
      recordLength: 8,
    });
  });

  it('decode Type-1 record containing field 1.003 (CNT)', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:24'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('2'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([28]),
    ]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('success');
    expect((result as Success<DecodeGenericRecordResult>).value).toEqual({
      record: {
        1: '24',
        3: [
          ['1', '1'],
          ['2', '00'],
        ],
      },
      recordLength: 24,
    });
  });

  it('decode Type-1 record containing field 1.003 (CNT) and no record separators', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:19'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([28]),
    ]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('success');
    expect((result as Success<DecodeGenericRecordResult>).value).toEqual({
      record: { 1: '19', 3: [['1', '1']] },
      recordLength: 19,
    });
  });

  it('decode Type-1 record containing field 1.068 (candidates) with record separators', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:25'),
      Buffer.from([29]),
      Buffer.from('1.068:CAN1'),
      Buffer.from([30]),
      Buffer.from('CAN2'),
      Buffer.from([28]),
    ]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('success');
    expect((result as Success<DecodeGenericRecordResult>).value).toEqual({
      record: { 1: '25', 68: ['CAN1', 'CAN2'] },
      recordLength: 25,
    });
  });

  it('decode Type-1 and Type-2 with default options', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:137'),
      Buffer.from([29]),
      Buffer.from('1.002:0502'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('2'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([29]),
      Buffer.from('1.004:CRM'),
      Buffer.from([29]),
      Buffer.from('1.005:20190717'),
      Buffer.from([29]),
      Buffer.from('1.007:DAI035454'),
      Buffer.from([29]),
      Buffer.from('1.008:ORI38574354'),
      Buffer.from([29]),
      Buffer.from('1.009:TCN2487S054'),
      Buffer.from([29]),
      Buffer.from('1.011:00.00'),
      Buffer.from([29]),
      Buffer.from('1.012:00.00'),
      Buffer.from([28]),
      Buffer.from('2.001:56'),
      Buffer.from([29]),
      Buffer.from('2.002:00'),
      Buffer.from([29]),
      Buffer.from('2.004:John'),
      Buffer.from([29]),
      Buffer.from('2.005:Doe'),
      Buffer.from([29]),
      Buffer.from('2.007:1978-05-12'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('success');
    expect((result as Success<NistFile>).value).toEqual({
      1: {
        1: '137',
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
      },
      2: {
        1: '56',
        2: '00',
        4: 'John',
        5: 'Doe',
        7: '1978-05-12',
      },
    });

    // Providing no value for decode options should work as well.
    const result2 = nistDecode(buffer);
    expect(result2.tag).toEqual('success');
  });

  it('decode Type-1, Type-2, and Type-4 with default options', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:156'),
      Buffer.from([29]),
      Buffer.from('1.002:0502'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('3'),
      Buffer.from([30]),
      Buffer.from('2'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([30]),
      Buffer.from('4'),
      Buffer.from([31]),
      Buffer.from('01'),
      Buffer.from([30]),
      Buffer.from('4'),
      Buffer.from([31]),
      Buffer.from('02'),
      Buffer.from([29]),
      Buffer.from('1.004:IDN'),
      Buffer.from([29]),
      Buffer.from('1.005:20190722'),
      Buffer.from([29]),
      Buffer.from('1.007:CABIS'),
      Buffer.from([29]),
      Buffer.from('1.008:MID00001'),
      Buffer.from([29]),
      Buffer.from('1.009:MBI20190722093422-IDE-00040'),
      Buffer.from([29]),
      Buffer.from('1.011:19.69'),
      Buffer.from([29]),
      Buffer.from('1.012:19.69'),
      Buffer.from([28]),
      Buffer.from('2.001:33'),
      Buffer.from([29]),
      Buffer.from('2.002:00'),
      Buffer.from([29]),
      Buffer.from('2.901:MID00001'),
      Buffer.from([28]),
      Buffer.from([0, 0, 38, 211, 1, 0, 7, 255, 255, 255, 255, 255, 0, 1, 244, 2, 238, 1]),
      fp1,
      Buffer.from([0, 0, 39, 170, 2, 0, 2, 255, 255, 255, 255, 255, 0, 1, 244, 2, 238, 1]),
      fp2,
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('success');
    expect((result as Success<NistFile>).value).toEqual({
      1: {
        1: '156',
        2: '0502',
        3: [
          ['1', '3'],
          ['2', '00'],
          ['4', '01'],
          ['4', '02'],
        ],
        4: 'IDN',
        5: '20190722',
        7: 'CABIS',
        8: 'MID00001',
        9: 'MBI20190722093422-IDE-00040',
        11: '19.69',
        12: '19.69',
      },
      2: {
        1: '33',
        2: '00',
        901: 'MID00001',
      },
      4: [
        { 1: '9939', 2: '1', 3: '0', 4: ['7'], 5: '0', 6: '500', 7: '750', 8: '1', 9: fp1 },
        { 1: '10154', 2: '2', 3: '0', 4: ['2'], 5: '0', 6: '500', 7: '750', 8: '1', 9: fp2 },
      ],
    });
  });

  it('optional field 2.023 with provided defaultValue', () => {
    const nistOriginal = {
      1: {
        2: '0502',
        4: 'SRE',
        5: '20191021',
        7: 'DAI035454',
        8: 'ORI385743',
        9: 'TCN-123343-1',
        10: 'TCN-123343',
        11: '00.00',
        12: '00.00',
      },
      2: { 34: 'N' },
    };
    const buffer = nistEncode(nistOriginal, {});
    expect(buffer.tag).toEqual('success');

    const result = nistDecode((buffer as Success<Buffer>).value, nistDecodeOptions);

    expect(result.tag).toEqual('success');
    expect((result as Success<NistFile>).value).toEqual({
      1: {
        1: '153',
        2: '0502',
        3: [
          ['1', '1'],
          ['2', '00'],
        ],
        4: 'SRE',
        5: '20191021',
        7: 'DAI035454',
        8: 'ORI385743',
        9: 'TCN-123343-1',
        10: 'TCN-123343',
        11: '00.00',
        12: '00.00',
      },
      2: {
        1: '26',
        2: '00',
        23: 'sorry',
        34: 'N',
      },
    });
  });

  it('SRE with a face (also contains file separator in binary JPEG data)', () => {
    const result = nistDecode(sreWithFace, {});

    expect(result.tag).toEqual('success');
    const nistFile = (result as Success<NistFile>).value;
    expect(nistFile).toEqual({
      1: {
        1: '198',
        2: '0500',
        3: [
          ['1', '02'],
          ['2', '00'],
          ['10', '01'],
        ],
        4: 'SRE',
        5: '20191023',
        6: '5',
        7: 'FIMB-SL',
        8: 'XXX',
        9: 'QS0000000405',
        10: 'MBI-20191023T125406.934-QS',
        11: '00.00',
        12: '00.00',
        14: '20191023125411Z',
      },
      2: {
        1: '64',
        2: '00',
        59: 'I',
        64: [['784336970', 'CRIMINAL']],
        550: 'CABIS',
      },
      10: [
        {
          1: '4025',
          2: '01',
          3: 'FACE',
          5: '20191023',
          6: '201',
          7: '251',
          8: '1',
          9: '0',
          10: '0',
          11: 'JPEGB',
          12: 'YCC',
          20: 'F',
          39: '784336970',
          999: expect.any(Buffer),
        },
      ],
    });
    if (nistFile[10]) {
      expect(nistFile[10][0][999]).toHaveLength(4025 - 157);
    }
  });
  it('decode Type-9 with default options', () => {
    const result = nistDecode(latentMinutiae, {});

    expect(result.tag).toEqual('success');
    const nistFile = (result as Success<NistFile>).value;
    const type9Records: NistType9Record[] = nistFile[9] as NistType9Record[];
    const type9Record = type9Records[0];
    expect(type9Record).toEqual({
      1: '284',
      2: '1',
      3: '7',
      4: 'U',
      300: [['1971', '2873', '0', '0', '0,0-0,2873-1971,2873-1971,0']],
      301: [['0', '30']],
      302: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'],
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
    });
  });
});

describe('negative test:', () => {
  it('Type-1 record does not end with a file separator', () => {
    const buffer = Buffer.concat([Buffer.from('1.001:8'), Buffer.from([30])]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record length field does not have any value', () => {
    const buffer = Buffer.concat([Buffer.from('1.001:'), Buffer.from([28])]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record length field does not contain field number separator', () => {
    const buffer = Buffer.concat([
      Buffer.from([0, 1, 2, 3, 4]),
      Buffer.from('1.001 8'),
      Buffer.from([28]),
      Buffer.from([13, 14, 15]),
    ]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 5, 12);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record length field does not contain field number in a correct format', () => {
    const buffer = Buffer.concat([Buffer.from('1 001:8'), Buffer.from([28])]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record length field does not have a numeric value', () => {
    const buffer = Buffer.concat([Buffer.from('1.001:<=>'), Buffer.from([28])]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record length field contains 0 for its value', () => {
    const buffer = Buffer.concat([Buffer.from('1.001:0'), Buffer.from([28])]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record length field contains a negative value', () => {
    const buffer = Buffer.concat([Buffer.from('1.001:-8'), Buffer.from([28])]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record contains NIST field 2.064 from a wrong record type', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:19'),
      Buffer.from([29]),
      Buffer.from('2.064:<=>'),
      Buffer.from([28]),
    ]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record length is more than the actual buffer length', () => {
    const buffer = Buffer.concat([Buffer.from('1.001:18'), Buffer.from([28])]);
    const result = decodeGenericNistRecord(buffer, 1, 1, 0, buffer.length - 1);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record does not end with a file separator', () => {
    const buffer = Buffer.concat([Buffer.from('1.001:18')]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-1 record does not have field 1.003 (CNT)', () => {
    const buffer = Buffer.concat([Buffer.from('1.001:8'), Buffer.from([28])]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 1.003 (CNT) is not an array', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:17'),
      Buffer.from([29]),
      Buffer.from('1.003:0'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 1.003 (CNT) at index #1 is not an array', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:21'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('1'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 1.003 (CNT) at index #1 does not contain a numeric IDC', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:24'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('<'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 1.003 (CNT) at index #1 indicates another Type-1 record', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:24'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('1'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 1.003 (CNT) at index #1 indicates two Type-2 records', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:29'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('2'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([30]),
      Buffer.from('2'),
      Buffer.from([31]),
      Buffer.from('01'),
      Buffer.from([28]),
      Buffer.from('2.001:8'),
      Buffer.from([28]),
      Buffer.from('2.001:8'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 1.003 (CNT) at index #1 contains unsupported record type', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:25'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('99'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-2 record is missing file separator', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:24'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('2'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([28]),
      Buffer.from('2.001:7'),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-4 record has insufficient length', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:24'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('4'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([28]),
      Buffer.from([1, 2, 3]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-4 record length indicates more bytes than available', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:24'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('4'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([28]),
      Buffer.from([0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('NIST field 1.002 is missing', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:19'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Missing mandatory field as mandated by TOT-specific options', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:137'),
      Buffer.from([29]),
      Buffer.from('1.002:0502'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('2'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([29]),
      Buffer.from('1.004:MAP'),
      Buffer.from([29]),
      Buffer.from('1.005:20190917'),
      Buffer.from([29]),
      Buffer.from('1.007:DAI035454'),
      Buffer.from([29]),
      Buffer.from('1.008:ORI38574354'),
      Buffer.from([29]),
      Buffer.from('1.009:TCN2487S054'),
      Buffer.from([29]),
      Buffer.from('1.011:00.00'),
      Buffer.from([29]),
      Buffer.from('1.012:00.00'),
      Buffer.from([28]),
      Buffer.from('2.001:56'),
      Buffer.from([29]),
      Buffer.from('2.002:00'),
      Buffer.from([29]),
      Buffer.from('2.004:John'),
      Buffer.from([29]),
      Buffer.from('2.005:Doe'),
      Buffer.from([29]),
      Buffer.from('2.007:1978-05-12'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_VALIDATION_ERROR');
    expect(failure).toMatchSnapshot();
  });

  it('Type-2 record is missing field 2.001 (LEN)', () => {
    const buffer = Buffer.concat([
      Buffer.from('1.001:24'),
      Buffer.from([29]),
      Buffer.from('1.003:1'),
      Buffer.from([31]),
      Buffer.from('1'),
      Buffer.from([30]),
      Buffer.from('2'),
      Buffer.from([31]),
      Buffer.from('00'),
      Buffer.from([28]),
      Buffer.from('2.003:A'),
      Buffer.from([28]),
    ]);
    const result = nistDecode(buffer, nistDecodeOptions);

    expect(result.tag).toEqual('failure');
    const failure = (result as Failure<NistError>).error;
    expect(failure.category).toEqual('NIST');
    expect(failure.code).toEqual('NIST_DECODE_ERROR');
    expect(failure).toMatchSnapshot();
  });
});
