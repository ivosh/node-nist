/* Customizable NIST file decoding and validation rules.
 * Used for decoding a Buffer into a NistFile.
 * For test purposes only. */
import { NistDecodeOptions } from './index';

export const nistDecodeOptions: NistDecodeOptions = {
  codecOptions: {
    MAP: {
      2: {
        48: {
          mandatory: true
        }
      }
    },
    SRE: {
      2: {
        23: {
          defaultValue: 'sorry',
          mandatory: true
        }
      }
    },
    default: {
      1: {
        2 /* ver */: {
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
          mandatory: true,
          regexs: [{ regex: '^[0-9]{2}.[0-9]{2}$', errMsg: 'Expected a string in format dd.dd' }]
        },
        12 /* ntr */: {
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
          mandatory: true
        },
        6 /* hll */: {
          mandatory: true
        },
        7 /* vll */: {
          mandatory: true
        },
        8 /* cga */: {
          mandatory: true
        }
      }
    }
  }
};
