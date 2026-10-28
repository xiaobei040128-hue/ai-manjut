import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, createCsv } from "../src/studio/downloads.ts";
test("CSV exports neutralize formulas, including whitespace-prefixed payloads", () => {
  for (const value of [
    "=1+1",
    "+SUM(1,2)",
    "@SUM(1,2)",
    "-1+2",
    '\t=HYPERLINK("https://example.com")',
    " \r\n+1",
    "\u0000=1",
  ])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell(-123), '"-123"');
  assert.equal(csvCell("张三,李四"), '"张三,李四"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell(undefined), '""');
  assert.equal(
    createCsv([
      ["名称", "金额"],
      ["测试", 12.5],
    ]),
    '\ufeff"名称","金额"\r\n"测试","12.5"',
  );
});
