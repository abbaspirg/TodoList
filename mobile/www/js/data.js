// Dispatches every operation to js/data-firestore.js or js/data-local.js
// depending on js/firebase.js isLocalMode() — see docs/ARCHITECTURE.md
// "Local Test Mode". Views only ever import this file, never the two
// backend-specific ones directly, so swapping backends never touches a view.
import { isLocalMode } from "./firebase.js";
import * as firestoreImpl from "./data-firestore.js";
import * as localImpl from "./data-local.js";

function impl() {
  return isLocalMode() ? localImpl : firestoreImpl;
}

export const watchGroups = (...args) => impl().watchGroups(...args);
export const watchGroupTotals = (...args) => impl().watchGroupTotals(...args);
export const addGroup = (...args) => impl().addGroup(...args);
export const updateGroup = (...args) => impl().updateGroup(...args);
export const deleteGroup = (...args) => impl().deleteGroup(...args);

export const watchCategories = (...args) => impl().watchCategories(...args);
export const addCategory = (...args) => impl().addCategory(...args);
export const updateCategory = (...args) => impl().updateCategory(...args);
export const deleteCategory = (...args) => impl().deleteCategory(...args);

export const watchStudents = (...args) => impl().watchStudents(...args);
export const addStudent = (...args) => impl().addStudent(...args);
export const updateStudent = (...args) => impl().updateStudent(...args);
export const deleteStudent = (...args) => impl().deleteStudent(...args);
export const uploadStudentPhoto = (...args) => impl().uploadStudentPhoto(...args);

export const watchItems = (...args) => impl().watchItems(...args);
export const watchItem = (...args) => impl().watchItem(...args);
export const addItem = (...args) => impl().addItem(...args);
export const updateItem = (...args) => impl().updateItem(...args);
export const setItemStatus = (...args) => impl().setItemStatus(...args);

export const watchRegistrations = (...args) => impl().watchRegistrations(...args);
export const registerStudent = (...args) => impl().registerStudent(...args);
export const withdrawRegistration = (...args) => impl().withdrawRegistration(...args);

export const watchJudges = (...args) => impl().watchJudges(...args);
export const addJudge = (...args) => impl().addJudge(...args);
export const assignJudgeToItems = (...args) => impl().assignJudgeToItems(...args);

export const watchScoresByJudge = (...args) => impl().watchScoresByJudge(...args);
export const submitScore = (...args) => impl().submitScore(...args);

export const watchPublishedResults = (...args) => impl().watchPublishedResults(...args);
export const watchAllResults = (...args) => impl().watchAllResults(...args);
export const publishResult = (...args) => impl().publishResult(...args);
