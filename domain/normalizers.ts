/*
 * Cleanup used only for comparing. Nothing here changes what we report back to
 * the user; the tidied strings exist purely so the matcher can hold two values
 * side by side and see whether they are the same.
 */

// Drop the ends and squash every run of spaces, tabs, and newlines down to one space.
const collapseWhitespace = (text: string): string => text.trim().replace(/\s+/g, " ");

/*
 * Tidies a label value so the differences that don't matter stop mattering:
 * "STONE'S THROW" and "Stone's Throw" both come out as "stone s throw", and so
 * do "45% Alc./Vol." and "45% ALC/VOL".
 */
export const normalizeText = (text: string): string =>
  collapseWhitespace(
    text
      // Split accented letters apart, then throw the accent away.
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      // Punctuation becomes a space rather than nothing, so "St.Louis" still lines up with "St Louis".
      .replace(/[^\p{L}\p{N}\s]/gu, " "),
  );

// The warning has to be word for word, so we only undo the line wrapping and leave everything else alone.
export const normalizeWarningText = collapseWhitespace;
