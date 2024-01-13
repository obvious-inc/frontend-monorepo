import { Diff } from "diff";

export const diffParagraphs = (() => {
  const diffInstance = new Diff();

  diffInstance.tokenize = function (value) {
    let retLines = [],
      linesAndNewlines = value.split(/(\n|\r\n)/);

    // Ignore the final empty token that occurs if the string ends with a new line
    if (!linesAndNewlines[linesAndNewlines.length - 1]) {
      linesAndNewlines.pop();
    }

    for (let i = 0; i < linesAndNewlines.length; i++) {
      let line = linesAndNewlines[i];

      if (i % 2 !== 0 || line.trim() === "") {
        let last = retLines[retLines.length - 1];
        retLines[retLines.length - 1] = last + line;
      } else {
        retLines.push(line);
      }
    }

    return retLines;
  };

  diffInstance.equals = function (left, right) {
    return Diff.prototype.equals.call(this, left?.trim(), right?.trim());
  };

  return (...args) => diffInstance.diff(...args);
})();
