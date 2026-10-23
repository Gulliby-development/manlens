<p align="center"><img src="docs/logo.svg" width="96" alt="" /></p>

# manlens

manlens is an offline command-line tool for people who write manual pages for command-line programs in the classic man macro language. Preview a page as plain text or ANSI-styled text, convert it to Markdown, lint it, list its documented options, and compare those options with saved `--help` output.

It is designed for command-line authors who want to catch documentation problems and option drift without depending on the operating system's manual-page tools. manlens works on Windows, macOS, and Linux; it does not require `man`, `groff`, or a pager. It makes no network calls, does not execute the documented program, and does not detect or read the terminal. Output uses LF line endings on every platform.

[![CI](https://github.com/Gulliby-development/manlens/actions/workflows/ci.yml/badge.svg)](https://github.com/Gulliby-development/manlens/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Install

Clone the repository and install the development tools with Bun (manlens itself has no runtime dependencies):

```sh
git clone https://github.com/Gulliby-development/manlens.git
cd manlens
bun install
```

Then run manlens from the project directory:

```sh
bun run src/main.ts
```

No manual-page renderer or pager is needed.

## Usage

```text
usage: manlens render [--width N] [--ansi] FILE
       manlens markdown FILE
       manlens lint FILE
       manlens flags FILE
       manlens drift MAN HELP
```

Use `--help` as the only argument to print these usage lines. For commands that read a page, pass a path or `-` to read standard input. `render` previews a page, `markdown` converts it, and `lint` reports page problems. `flags` lists options documented by the page. `drift` compares a manual page with a saved help-text file; it reads that file and never runs the documented program.

### Render example

Save the following page as `fetcher.1`:

```text
.TH FETCHER 1 "2026-01-05" "fetcher 2.1"
.SH NAME
fetcher \- download files
.SS Options
.TP
.BR \-v ", " \-\-verbose
Print one line per address.
.IP \(bu 2
A bullet with text that is long enough to wrap in the middle.
```

Run:

```sh
bun run src/main.ts render --width 40 fetcher.1
```

Output:

```text
FETCHER(1)

NAME
       fetcher - download files

   Options

       -v, --verbose
              Print one line per
              address.

       o A bullet with text that is long
         enough to wrap in the middle.
```

### Drift example

Save this manual page as `m.1`:

```text
.TH M 1
.SH OPTIONS
.TP
\fB\-a\fR, \fB\-\-all\fR
Everything.
.TP
\fB\-n\fR \fIN\fR
Count.
.TP
\fB\-\-color\fR[=\fIWHEN\fR]
Colors.
.TP
\fB\-x\fR
Extra.
.TP
Environment
Not an option tag.
.IP "\-k <key>, \-\-key=<key>" 8
Keyed.
.TP
\fB\-\-width\fR \fIN\fR
Wrap.
```

Save the program's help text as `m.help`. Replace each `<TAB>` marker below with an actual tab character when saving the file:

```text
Usage: m [options] FILE

Options:
  -a, --all           everything
  -n, --lines N       count
      --color         colors
  -h, --help          show this text
  -k <key>, --key=<key>  keyed
  -w, --width=N       wrap
  -5 is not an option line
Environment:
<TAB>-q<TAB>quiet (a TAB ends the option part)
```

Run the comparison:

```sh
bun run src/main.ts drift m.1 m.help
```

Output:

```text
only in man: -x (man line 12)
only in help: -h, --help (help line 7)
only in help: -q (help line 12)
argument differs: --color (man [WHEN], help none; man line 9, help line 6)
names differ: -n (man -n; help -n, --lines; man line 6, help line 5)
names differ: --width (man --width; help -w, --width; man line 20, help line 9)
6 differences
```

Commands return 0 on success, 1 when lint finds problems or drift finds differences, and 2 for an error. Errors are written to standard error; successful command output is written to standard output.

## Page language

manlens reads UTF-8 pages and supports these requests: `.TH`, `.SH`, `.SS`, `.PP`, `.P`, `.LP`, `.TP`, `.IP`, `.RS`, `.RE`, `.B`, `.I`, `.BR`, `.BI`, `.IB`, `.IR`, `.RB`, `.RI`, `.nf`, `.fi`, `.br`, and `.sp`. Requests are case-sensitive.

Supported inline escapes include `\\` and `\e` for a backslash, `\-` for a hyphen, `\ ` for a non-breaking space, and `\&` and `\%` for no output. `\fR`, `\fB`, and `\fI` select roman, bold, and italic text; `\fP` restores the previous font. Special-character escapes include `\(em` (two hyphens), `\(en` and `\(hy` (hyphens), `\(bu` (a bullet), `\(co` (copyright), `\(rg` (registered), `\(lq`, `\(rq`, and `\(dq` (double quotes), and `\(oq`, `\(cq`, and `\(aq` (single quotes). Unknown requests and escapes are reported by `lint`.

## Development

Run the project checks from the project directory:

```sh
bun install
bun run typecheck
bun run lint
bun test
```

## License

MIT, see [LICENSE](LICENSE).

---

Built with BAKED
