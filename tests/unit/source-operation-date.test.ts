import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceEditTimestamp} from '../../src/vendors/sync/operation-date.js';
test('explicit-offset calendar validation preserves microseconds and never assumes process timezone',()=>{
 for(const value of ['2026-02-18T11:02:37.367362+05:00','2026-02-04T21:56:10.5001012+05:00','2024-02-29T00:00:00Z','2026-01-01T12:00:00-03:30'])assert.equal(sourceEditTimestamp(value),value);
 for(const value of [undefined,null,123,true,'','2026-02-29T00:00:00Z','2026-02-30T00:00:00Z','2026-13-01T00:00:00Z','2026-01-00T00:00:00Z','0000-01-01T00:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:60:00Z','2026-01-01T00:00:60Z','2026-01-01T00:00:00','2026-01-01','2026-01-01T00:00:00+05:60','2026-01-01T00:00:00+16:00','2026-01-01T00:00:00.1234567890Z'])assert.equal(sourceEditTimestamp(value),null);
});
