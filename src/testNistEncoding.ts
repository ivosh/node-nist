/* Customizable NIST file encoding and validation rules.
 * Used for encoding a NistFile into a Buffer.
 * For test purposes only. */
import { NistEncodeOptions, NistField, NistFile } from './index';

// :TODO: check for resolution of Type-14 if present
const getFingerprintResolution = (nist: NistFile): string => (nist[4] ? '19.69' : '00.00');

// :TODO: should be determined automatically from WSQ image
const getHorizontalScanningLine = (): string => '500';
// :TODO: should be determined automatically from WSQ image
const getVerticalScanningLine = (): string => '750';

export const nistEncodeOptions: NistEncodeOptions = {
  codecOptions: {
    MAP: {
      1: {
        6: {
          defaultValue: '5',
          mandatory: true,
          regexs: [{ regex: '^[1-9]{1}$', errMsg: 'Expected a number between 1 and 9' }]
        }
      }
    },
    SRE: {
      2: {
        59 /* srf */: {
          mandatory: true,
          maxLength: 1,
          regexs: [{ regex: '^[IN]$', errMsg: 'Expected I or N' }]
        },
        64 /* can */: {
          mandatory: (field, nist) => (nist[2] && nist[2][59] && nist[2][59] === 'I') || false
        }
      }
    },
    default: {
      1: {
        2 /* ver */: {
          defaultValue: '0502', // conforming to ANSI/NIST-ITL 1-2011 edition 3 update 2015
          formatter: (field: NistField) => String(field.value).padStart(4, '0'),
          mandatory: true,
          maxLength: 4,
          minLength: 3,
          regexs: [{ regex: '^[0-9]{3,4}$', errMsg: 'Expected three or four digits' }]
        },
        4 /* tot */: {
          mandatory: true,
          maxLength: 16
        },
        5 /* dat */: {
          mandatory: true,
          regexs: [{ regex: '^[0-9]{8}$', errMsg: 'Expected eight digits' }]
        },
        6 /* pry */: {
          mandatory: false,
          regexs: [{ regex: '^[1-9]{1}$', errMsg: 'Expected a number between 1 and 9' }]
        },
        7 /* dai */: {
          mandatory: true
        },
        8 /* ori */: {
          mandatory: true
        },
        9 /* tcn */: {
          mandatory: true
        },
        10 /* tcr */: {
          mandatory: false
        },
        11 /* nsr */: {
          defaultValue: (field: NistField, nist: NistFile) => getFingerprintResolution(nist),
          mandatory: true,
          regexs: [{ regex: '^[0-9]{2}.[0-9]{2}$', errMsg: 'Expected a string in format dd.dd' }]
        },
        12 /* ntr */: {
          defaultValue: (field: NistField, nist: NistFile) => getFingerprintResolution(nist),
          mandatory: true,
          regexs: [{ regex: '^[0-9]{2}.[0-9]{2}$', errMsg: 'Expected a string in format dd.dd' }]
        }
      },
      4: {
        3 /* imp */: {
          mandatory: true
        },
        4 /* fgp */: {
          mandatory: true
        },
        5 /* isr */: {
          defaultValue: '0', // 500 ppi
          mandatory: true
        },
        6 /* hll */: {
          defaultValue: () => getHorizontalScanningLine(),
          mandatory: true
        },
        7 /* vll */: {
          defaultValue: () => getVerticalScanningLine(),
          mandatory: true
        },
        8 /* cga */: {
          defaultValue: '1', // WSQ
          mandatory: true
        },
        9 /* data */: {
          mandatory: true
        }
      },
      10: {
        3 /* imt */: {
          mandatory: true
        },
        4 /* src */: {
          mandatory: true
        },
        5 /* phd */: {
          mandatory: true,
          regexs: [{ regex: '^[0-9]{8}$', errMsg: 'Expected eight digits' }]
        },
        6 /* hll */: {
          mandatory: true,
          maxLength: 5,
          minLength: 2,
          regexs: [
            { regex: '^[0-9]{1,5}$', errMsg: 'Expected a positive number between 10 and 99999' }
          ]
        },
        7 /* vll */: {
          mandatory: true,
          maxLength: 5,
          minLength: 2,
          regexs: [
            { regex: '^[0-9]{1,5}$', errMsg: 'Expected a positive number between 10 and 99999' }
          ]
        },
        8 /* slc */: {
          mandatory: true,
          maxLength: 1,
          minLength: 1,
          regexs: [{ regex: '^[0-2]{1}$', errMsg: 'Expected a positive number between 0 and 2' }]
        },
        9 /* thps */: {
          mandatory: true,
          maxLength: 5,
          minLength: 1,
          regexs: [
            { regex: '^[0-9]{1,5}$', errMsg: 'Expected a positive number between 1 and 99999' }
          ]
        },
        10 /* tvps */: {
          mandatory: true,
          maxLength: 5,
          minLength: 1,
          regexs: [
            { regex: '^[0-9]{1,5}$', errMsg: 'Expected a positive number between 1 and 99999' }
          ]
        },
        11 /* cga */: {
          mandatory: true,
          maxLength: 5,
          minLength: 3,
          regexs: [
            {
              errMsg: 'Expected a valid compression algorithm for a face image',
              regex: '^(?:JPEGB|JPEGL|JP2|PNG)$'
            }
          ]
        },
        12 /* csp */: {
          mandatory: true,
          maxLength: 4,
          minLength: 3
        },
        20 /* pos */: {
          maxLength: 1,
          regexs: [{ regex: '^[FRLAD]$', errMsg: 'Expected a valid subject pose for a face image' }]
        },
        999 /* data */: {
          mandatory: true
        }
      },
      13: {
        3 /* imp */: {
          mandatory: true
        },
        4 /* src */: {
          mandatory: true
        },
        5 /* lcd */: {
          mandatory: true,
          regexs: [{ regex: '^[0-9]{8}$', errMsg: 'Expected eight digits' }]
        },
        6 /* hll */: {
          mandatory: true,
          maxLength: 5,
          minLength: 2,
          regexs: [
            { regex: '^[0-9]{1,5}$', errMsg: 'Expected a positive number between 10 and 99999' }
          ]
        },
        7 /* vll */: {
          mandatory: true,
          maxLength: 5,
          minLength: 2,
          regexs: [
            { regex: '^[0-9]{1,5}$', errMsg: 'Expected a positive number between 10 and 99999' }
          ]
        },
        8 /* slc */: {
          mandatory: true,
          maxLength: 1,
          minLength: 1,
          regexs: [{ regex: '^[0-2]{1}$', errMsg: 'Expected a positive number between 0 and 2' }]
        },
        9 /* thps */: {
          mandatory: true,
          maxLength: 5,
          minLength: 1,
          regexs: [
            { regex: '^[0-9]{1,5}$', errMsg: 'Expected a positive number between 1 and 99999' }
          ]
        },
        10 /* tvps */: {
          mandatory: true,
          maxLength: 5,
          minLength: 1,
          regexs: [
            { regex: '^[0-9]{1,5}$', errMsg: 'Expected a positive number between 1 and 99999' }
          ]
        },
        11 /* cga */: {
          mandatory: true,
          maxLength: 5,
          minLength: 3,
          regexs: [
            {
              errMsg: 'Expected a valid compression algorithm for a latent image',
              regex: '^(?:JPEGL|JP2L|PNG|WSQ)$'
            }
          ]
        },
        12 /* bpx */: {
          mandatory: true,
          maxLength: 2,
          minLength: 1,
          regexs: [{ regex: '^[0-9]{1,2}$', errMsg: 'Expected a positive number between 8 and 99' }]
        },
        13 /* fgp */: {
          mandatory: true
        },
        999 /* data */: {
          mandatory: true
        }
      }
    }
  }
};
