// Generates a roster of sample students for testing against a real
// Firebase project — 10 per class across Classes 1-10.
//
// Distinct from js/demo-data.js, which builds a whole fest and wipes
// everything first. That is fine for the localStorage sandbox but would be
// destructive against a live project, so this one only ever *adds*
// students and leaves items, judges and results alone.
//
// IDs are deterministic (`sample-c3-s07`), so running it twice overwrites
// the same 100 documents rather than piling up 200, and "Remove sample
// students" can find exactly what it created without touching real ones.

const FIRST_NAMES = [
  "Muhammed", "Abdul", "Ibrahim", "Yusuf", "Hamza", "Bilal", "Umar", "Salman", "Zayyan", "Rashid",
  "Fathima", "Ayisha", "Khadeeja", "Zainab", "Ruqayya", "Aminah", "Safiya", "Maryam", "Hafsa", "Sumayya",
];

const SECOND_NAMES = [
  "Ashraf", "Rahman", "Sadiq", "Hameed", "Faisal", "Ahmed", "Farooq", "Noor", "Siddiq", "Kareem",
];

const SAMPLE_PREFIX = "sample-";
export const SAMPLE_CLASS_COUNT = 10;
export const SAMPLE_PER_CLASS = 10;

export function isSampleStudent(student) {
  return typeof student?.id === "string" && student.id.startsWith(SAMPLE_PREFIX);
}

/** Builds the roster without writing anything, so a caller can count it or
 * preview it. Groups and categories are whatever the fest already has —
 * this never invents them.
 *
 * Classes map onto categories in order rather than round-robin: a category
 * is an age band, so Class 1 and Class 2 belonging to the same one is
 * right, while Class 1 and Class 9 sharing one would be nonsense. */
export function buildSampleStudents(festId, groups, categories) {
  const students = [];
  for (let classNo = 1; classNo <= SAMPLE_CLASS_COUNT; classNo++) {
    const categoryId = categories.length
      ? categories[Math.min(categories.length - 1, Math.floor(((classNo - 1) / SAMPLE_CLASS_COUNT) * categories.length))]
          .id
      : null;

    for (let n = 1; n <= SAMPLE_PER_CLASS; n++) {
      const index = (classNo - 1) * SAMPLE_PER_CLASS + (n - 1);
      const first = FIRST_NAMES[index % FIRST_NAMES.length];
      const second = SECOND_NAMES[Math.floor(index / FIRST_NAMES.length) % SECOND_NAMES.length];
      students.push({
        id: `${SAMPLE_PREFIX}c${classNo}-s${String(n).padStart(2, "0")}`,
        festId,
        name: `${first} ${second}`,
        className: `Class ${classNo}`,
        // Alternating rather than random, so each class splits evenly
        // between the competing groups instead of landing lopsided.
        groupId: groups.length ? groups[index % groups.length].id : null,
        categoryId,
        photoUrl: null,
      });
    }
  }
  return students;
}
