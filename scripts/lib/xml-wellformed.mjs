// A small hand-written XML well-formedness checker -- a real tokenizing
// parser over the character stream (tracks an element stack, validates
// comment/CDATA/PI syntax, rejects unescaped `&`/`<`, requires exactly one
// root element), not a regex pass over the whole document or a visual
// inspection. It exists because this repo has no XML-parsing dependency
// installed, and the one bug this whole pipeline is being fixed for --
// `<!-- ... -- ... -->`, a double hyphen inside a comment -- is exactly the
// kind of thing eyeballing a file misses and a real parser catches for free.
//
// Deliberately scoped to what a sitemap/robots-adjacent XML file actually
// needs (elements, attributes, comments, CDATA, the `<?xml ... ?>` prolog,
// entity/char references) -- no DTD, no namespaces beyond treating `:` as a
// legal name character, no external entities.

export class XmlWellFormednessError extends Error {}

const NAME_START = /[A-Za-z_:]/;
const NAME_CHAR = /[A-Za-z0-9_:.-]/;
const WHITESPACE = /[ \t\r\n]/;

class Cursor {
  constructor(text) {
    this.text = text;
    this.i = 0;
  }
  get done() {
    return this.i >= this.text.length;
  }
  peek(offset = 0) {
    return this.text[this.i + offset];
  }
  startsWith(str) {
    return this.text.startsWith(str, this.i);
  }
  lineCol() {
    const upToHere = this.text.slice(0, this.i);
    const line = (upToHere.match(/\n/g) || []).length + 1;
    const col = this.i - upToHere.lastIndexOf("\n");
    return { line, col };
  }
  fail(message) {
    const { line, col } = this.lineCol();
    throw new XmlWellFormednessError(`${message} (line ${line}, column ${col})`);
  }
  skipWhitespace() {
    while (!this.done && WHITESPACE.test(this.peek())) this.i++;
  }
}

function readName(c) {
  if (c.done || !NAME_START.test(c.peek())) c.fail("Expected a name");
  const start = c.i;
  c.i++;
  while (!c.done && NAME_CHAR.test(c.peek())) c.i++;
  return c.text.slice(start, c.i);
}

function checkReferences(c, text) {
  let idx = 0;
  while ((idx = text.indexOf("&", idx)) !== -1) {
    const rest = text.slice(idx);
    const match = /^&(amp|lt|gt|apos|quot|#[0-9]+|#x[0-9a-fA-F]+);/.exec(rest);
    if (!match) c.fail(`Unescaped "&" (must be "&amp;" or a valid entity/character reference)`);
    idx += match[0].length;
  }
  if (text.includes("<")) c.fail(`Unescaped "<" in text content`);
}

function skipProlog(c) {
  if (c.startsWith("<?xml")) {
    const end = c.text.indexOf("?>", c.i);
    if (end === -1) c.fail(`Unterminated XML declaration "<?xml ... ?>"`);
    c.i = end + 2;
  }
}

function skipComment(c) {
  const start = c.i;
  c.i += 4; // past "<!--"
  const end = c.text.indexOf("-->", c.i);
  if (end === -1) c.fail(`Unterminated comment (missing "-->")`);
  const content = c.text.slice(c.i, end);
  if (content.includes("--")) {
    c.i = start;
    c.fail(`Comment contains "--", which is not allowed anywhere inside an XML comment`);
  }
  if (content.endsWith("-")) {
    c.i = start;
    c.fail(`Comment must not end with "-" immediately before "-->"`);
  }
  c.i = end + 3;
}

function skipCData(c) {
  const end = c.text.indexOf("]]>", c.i);
  if (end === -1) c.fail(`Unterminated CDATA section (missing "]]>")`);
  c.i = end + 3;
}

function skipProcessingInstruction(c) {
  const end = c.text.indexOf("?>", c.i);
  if (end === -1) c.fail(`Unterminated processing instruction (missing "?>")`);
  c.i = end + 2;
}

function readAttributes(c) {
  const names = new Set();
  for (;;) {
    c.skipWhitespace();
    if (c.done) c.fail("Unterminated start tag");
    if (c.peek() === ">" || c.peek() === "/") return;
    const name = readName(c);
    if (names.has(name)) c.fail(`Duplicate attribute "${name}"`);
    names.add(name);
    c.skipWhitespace();
    if (c.peek() !== "=") c.fail(`Expected "=" after attribute name "${name}"`);
    c.i++;
    c.skipWhitespace();
    const quote = c.peek();
    if (quote !== '"' && quote !== "'") c.fail(`Attribute "${name}" value must be quoted`);
    c.i++;
    const end = c.text.indexOf(quote, c.i);
    if (end === -1) c.fail(`Unterminated attribute value for "${name}"`);
    const value = c.text.slice(c.i, end);
    checkReferences(c, value);
    c.i = end + 1;
  }
}

/**
 * Throws XmlWellFormednessError with a `line`/`column`-annotated message on
 * the first well-formedness violation found. Returns nothing on success.
 * @param {string} xml
 */
export function assertWellFormedXml(xml) {
  const text = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const c = new Cursor(text);
  const stack = [];
  let rootCount = 0;

  skipProlog(c);

  while (!c.done) {
    if (c.startsWith("<!--")) {
      skipComment(c);
      continue;
    }
    if (c.startsWith("<![CDATA[")) {
      if (stack.length === 0) c.fail("CDATA section outside of any element");
      c.i += 9;
      skipCData(c);
      continue;
    }
    if (c.startsWith("<?")) {
      skipProcessingInstruction(c);
      continue;
    }
    if (c.startsWith("</")) {
      c.i += 2;
      const name = readName(c);
      c.skipWhitespace();
      if (c.peek() !== ">") c.fail(`Expected ">" to close end tag "</${name}>"`);
      c.i++;
      if (stack.length === 0) c.fail(`End tag "</${name}>" has no matching start tag`);
      const open = stack.pop();
      if (open !== name) c.fail(`Mismatched tag: expected "</${open}>" but found "</${name}>"`);
      continue;
    }
    if (c.peek() === "<") {
      if (stack.length === 0) {
        if (rootCount >= 1)
          c.fail("Multiple root elements -- an XML document must have exactly one");
        rootCount++;
      }
      c.i++;
      const name = readName(c);
      readAttributes(c);
      if (c.peek() === "/") {
        c.i++;
        if (c.peek() !== ">") c.fail(`Expected ">" after "/" in self-closing tag "<${name}/>"`);
        c.i++;
      } else if (c.peek() === ">") {
        c.i++;
        stack.push(name);
      } else {
        c.fail(`Expected ">" or "/>" to close start tag "<${name}>"`);
      }
      continue;
    }
    // Text node: read up to the next "<"
    const start = c.i;
    while (!c.done && c.peek() !== "<") c.i++;
    const text_ = c.text.slice(start, c.i);
    if (stack.length === 0 && text_.trim() !== "") {
      c.i = start;
      c.fail("Non-whitespace text found outside the root element");
    }
    checkReferences(c, text_);
  }

  if (stack.length > 0) c.fail(`Unclosed element(s): ${stack.map((n) => `<${n}>`).join(", ")}`);
  if (rootCount === 0) c.fail("No root element found");
}

/**
 * Extracts the text content of every `<loc>` element. Only meaningful to
 * call after assertWellFormedXml() has already passed -- this is a
 * convenience extraction over already-validated markup, not itself a
 * well-formedness check.
 * @param {string} xml
 * @returns {string[]}
 */
export function extractLocValues(xml) {
  const matches = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)];
  return matches.map((m) => m[1].trim());
}
