function parseCsv(source) {
  if (source.charCodeAt(0) === 0xfeff) {
    source = source.slice(1);
  }
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  let quoteClosed = false;

  function finishRow() {
    row.push(value.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
    row = [];
    value = "";
    quoteClosed = false;
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        value += character;
      }
    } else if (quoteClosed) {
      if (character === ",") {
        row.push(value.trim());
        value = "";
        quoteClosed = false;
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && source[index + 1] === "\n") {
          index += 1;
        }
        finishRow();
      } else if (character !== " " && character !== "\t") {
        throw new Error("CSV contains unexpected text after a quoted field.");
      }
    } else if (character === '"' && value.trim().length === 0) {
      value = "";
      quoted = true;
    } else if (character === '"') {
      throw new Error("CSV contains a quote inside an unquoted field.");
    } else if (character === ",") {
      row.push(value.trim());
      value = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      finishRow();
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unclosed quoted field.");
  }
  finishRow();
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.toLowerCase());
  if (
    !headers.includes("longurl") ||
    headers.some((header) => !["longurl", "customalias"].includes(header))
  ) {
    throw new Error("CSV must include longUrl and may include customAlias columns.");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV column names must be unique.");
  }

  return rows.slice(1).map((cells) => {
    if (cells.length !== headers.length) {
      return { invalidRow: true };
    }
    return Object.fromEntries(headers.map((header, index) => [
      header === "longurl" ? "longUrl" : "customAlias",
      cells[index]
    ]));
  });
}

export function parseLinkImport(source, format) {
  if (typeof source !== "string") {
    throw new Error("Import content must be text.");
  }
  if (format === "csv") {
    return parseCsv(source);
  }
  if (format !== "lines") {
    throw new Error("Choose CSV or one URL per line.");
  }
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((longUrl) => ({ longUrl }));
}
