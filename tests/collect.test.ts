import { expect, test } from "bun:test";
import { buildDoc } from "../src/doc/build";
import { flagsTable, helpEntries, manEntries } from "../src/flags/collect";

test("collects tagged manual options in document order with source lines", () => {
  const doc = buildDoc(
    '.TH T 1\n.TP\n.BR \\-v ", " \\-\\-verbose\nText.\n.IP "\\-k <key>, \\-\\-key=<key>" 8\nKey.\n.TP\nEnvironment\nIgnored.\n',
  );
  expect(JSON.stringify(manEntries(doc))).toBe(
    '[{"names":["-v","--verbose"],"arg":null,"line":2},{"names":["-k","--key"],"arg":{"name":"<key>","optional":false},"line":5}]',
  );
});

test("ignores untagged, preformatted, empty and invalid manual tags", () => {
  const doc = buildDoc('.TH T 1\n.SH NAME\n-a\n.nf\n--raw\n.fi\n.IP ""\n.TP\n-x,\n');
  expect(manEntries(doc)).toEqual([]);
});

test("preserves repeated aliases and selects the first argument", () => {
  const doc = buildDoc('.TH T 1\n.IP "-a, -a N, --all [OTHER]"\n');
  expect(manEntries(doc)).toEqual([
    { names: ["-a", "-a", "--all"], arg: { name: "N", optional: false }, line: 2 },
  ]);
  expect(doc).toEqual({
    title: { name: "T", section: "1", date: "", source: "", manual: "" },
    blocks: [
      {
        kind: "item",
        line: 2,
        gap: 1,
        margin: 7,
        indent: 7,
        tag: [{ text: "-a, -a N, --all [OTHER]", font: "R" }],
        segs: [],
      },
    ],
    problems: [],
    lines: 2,
  });
});

test("collects help options only up to the first delimiter", () => {
  expect(
    JSON.stringify(
      helpEntries(
        "Usage: m\n\n  -a, --all  all\n\t-q\tquiet\n  -n N\n --color[=WHEN]\n -5 is not an option line\n -x\n -x,\n",
      ),
    ),
  ).toBe(
    '[{"names":["-a","--all"],"arg":null,"line":3},{"names":["-q"],"arg":null,"line":4},{"names":["-n"],"arg":{"name":"N","optional":false},"line":5},{"names":["--color"],"arg":{"name":"WHEN","optional":true},"line":6}]',
  );
});

test("collects short numeric and long dashed help options", () => {
  expect(
    JSON.stringify(helpEntries("-5\n --dry-run\n -n [N]  count\n --key=<key>\n -abc\n --\n")),
  ).toBe(
    '[{"names":["-5"],"arg":null,"line":1},{"names":["--dry-run"],"arg":null,"line":2},{"names":["-n"],"arg":{"name":"N","optional":true},"line":3},{"names":["--key"],"arg":{"name":"<key>","optional":false},"line":4}]',
  );
});

test("keeps help source lines and trims only option-prefix delimiters", () => {
  expect(helpEntries("  -n  N\n -k\t<key>\n")).toEqual([
    { names: ["-n"], arg: null, line: 1 },
    { names: ["-k"], arg: null, line: 2 },
  ]);
  expect(helpEntries("")).toEqual([]);
});

test("returns no table for an empty option list", () => {
  expect(flagsTable([])).toBe("");
});

test("formats options, arguments and source lines in input order", () => {
  const entries = [
    { names: ["-a", "--all"], arg: null, line: 3 },
    { names: ["-n"], arg: { name: "N", optional: false }, line: 6 },
    { names: ["--color"], arg: { name: "WHEN", optional: true }, line: 9 },
    { names: ["-x"], arg: null, line: 12 },
    { names: ["-k", "--key"], arg: { name: "<key>", optional: false }, line: 18 },
    { names: ["--width"], arg: { name: "N", optional: false }, line: 20 },
  ];
  expect(flagsTable(entries)).toBe(
    "OPTIONS    ARG     LINE\n-a, --all  -       3\n-n         N       6\n--color    [WHEN]  9\n-x         -       12\n-k, --key  <key>   18\n--width    N       20\n",
  );
  expect(JSON.stringify(entries)).toBe(
    '[{"names":["-a","--all"],"arg":null,"line":3},{"names":["-n"],"arg":{"name":"N","optional":false},"line":6},{"names":["--color"],"arg":{"name":"WHEN","optional":true},"line":9},{"names":["-x"],"arg":null,"line":12},{"names":["-k","--key"],"arg":{"name":"<key>","optional":false},"line":18},{"names":["--width"],"arg":{"name":"N","optional":false},"line":20}]',
  );
  expect(entries).toEqual([
    { names: ["-a", "--all"], arg: null, line: 3 },
    { names: ["-n"], arg: { name: "N", optional: false }, line: 6 },
    { names: ["--color"], arg: { name: "WHEN", optional: true }, line: 9 },
    { names: ["-x"], arg: null, line: 12 },
    { names: ["-k", "--key"], arg: { name: "<key>", optional: false }, line: 18 },
    { names: ["--width"], arg: { name: "N", optional: false }, line: 20 },
  ]);
});

test("sanitizes table cells before calculating their widths", () => {
  const entries = [{ names: ["--key"], arg: { name: "<é😀>", optional: false }, line: 2 }];
  expect(flagsTable(entries)).toBe("OPTIONS  ARG   LINE\n--key    <??>  2\n");
  expect(JSON.stringify(entries)).toBe(
    '[{"names":["--key"],"arg":{"name":"<é😀>","optional":false},"line":2}]',
  );
  expect(entries).toEqual([{ names: ["--key"], arg: { name: "<é😀>", optional: false }, line: 2 }]);
});
