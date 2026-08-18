/**
 * Cloud Functions backing the Madrasa Meelad Fest Manager — see
 * docs/ARCHITECTURE.md §5 "Real-Time Scoring & Result Computation Flow" for
 * the full flow this file implements.
 */
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { PointSystem, pointsForRank } from "./pointSystem";

admin.initializeApp();
const db = admin.firestore();

/**
 * Admin-only: assigns a judge to a set of items. Updates both the judge's
 * Firestore doc (assignedItemIds, used by the Judge Panel's item queue
 * query) AND the judge's Firebase Auth custom claims (assignedItems, used
 * by firestore.rules to authorize score writes) in one call so the two
 * never drift out of sync.
 */
export const assignJudgeToItems = onCall(async (request) => {
  const callerRole = request.auth?.token.role;
  if (callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Only an Admin can assign judges.");
  }

  const { judgeId, itemIds } = request.data as { judgeId: string; itemIds: string[] };
  if (!judgeId || !Array.isArray(itemIds)) {
    throw new HttpsError("invalid-argument", "judgeId and itemIds are required.");
  }

  const judgeSnap = await db.collectionGroup("judges")
    .where(admin.firestore.FieldPath.documentId(), "==", judgeId)
    .limit(1)
    .get();
  if (judgeSnap.empty) {
    throw new HttpsError("not-found", `Judge ${judgeId} not found.`);
  }
  const judgeDoc = judgeSnap.docs[0];
  const authUid = judgeDoc.data().authUid as string | undefined;

  await judgeDoc.ref.update({ assignedItemIds: itemIds });

  if (authUid) {
    const user = await admin.auth().getUser(authUid);
    await admin.auth().setCustomUserClaims(authUid, {
      ...user.customClaims,
      role: "judge",
      assignedItems: itemIds,
    });
  }

  // Denormalize the reverse mapping onto each item doc too, so the
  // onScoreWrite trigger below can cheaply read "how many judges are
  // assigned to this item" without a query.
  const batch = db.batch();
  for (const itemId of itemIds) {
    const itemSnap = await db.collectionGroup("items")
      .where(admin.firestore.FieldPath.documentId(), "==", itemId)
      .limit(1)
      .get();
    if (!itemSnap.empty) {
      batch.update(itemSnap.docs[0].ref, {
        assignedJudgeIds: admin.firestore.FieldValue.arrayUnion(judgeId),
      });
    }
  }
  await batch.commit();

  return { success: true };
});

/**
 * Fires on every judge score submission. Recomputes the participant's
 * average, and once every assigned judge for the item has scored every
 * registered participant, finalizes the item's Result: ranks participants,
 * assigns points from the configured PointSystem, and atomically increments
 * each winning participant's Group's running total.
 */
export const onScoreWrite = onDocumentCreated("scores/{scoreId}", async (event) => {
  const score = event.data?.data();
  if (!score) return;

  const { itemId } = score as { itemId: string };

  const itemSnap = await db.collectionGroup("items")
    .where(admin.firestore.FieldPath.documentId(), "==", itemId)
    .limit(1)
    .get();
  if (itemSnap.empty) return;
  const itemRef = itemSnap.docs[0].ref;
  const item = itemSnap.docs[0].data();
  const assignedJudgeIds: string[] = item.assignedJudgeIds ?? [];
  if (assignedJudgeIds.length === 0) return; // nothing to compare against yet

  const registrationsSnap = await db.collectionGroup("registrations")
    .where("itemId", "==", itemId)
    .get();
  const registrations = registrationsSnap.docs;
  if (registrations.length === 0) return;

  const scoresSnap = await db.collection("scores").where("itemId", "==", itemId).get();
  const scoresByRegistration = new Map<string, number[]>();
  for (const doc of scoresSnap.docs) {
    const s = doc.data();
    const list = scoresByRegistration.get(s.registrationId) ?? [];
    list.push(s.totalMarks);
    scoresByRegistration.set(s.registrationId, list);
  }

  // Only finalize once every registered participant has a score from every
  // assigned judge — see ARCHITECTURE.md §5 step 4.
  const allScored = registrations.every(
    (r) => (scoresByRegistration.get(r.id)?.length ?? 0) >= assignedJudgeIds.length,
  );
  if (!allScored) return;

  const ranked = registrations
    .map((r) => {
      const data = r.data();
      const marks = scoresByRegistration.get(r.id) ?? [];
      const average = marks.reduce((a, b) => a + b, 0) / marks.length;
      return { registrationId: r.id, ...data, totalMarks: average };
    })
    .sort((a, b) => b.totalMarks - a.totalMarks)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      points: pointsForRank(PointSystem.default, index + 1),
    }));

  await db.runTransaction(async (tx) => {
    const festId = itemRef.parent.parent!.id;
    const resultRef = db.collection("fests").doc(festId).collection("results").doc(itemId);

    tx.set(resultRef, {
      itemName: item.name,
      rankings: ranked,
      finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
      published: false,
    });
    tx.update(itemRef, { status: "completed" });

    for (const entry of ranked) {
      const groupTotalRef = db
        .collection("fests")
        .doc(festId)
        .collection("groupTotals")
        .doc(entry.groupId);
      tx.set(
        groupTotalRef,
        {
          groupId: entry.groupId,
          groupName: entry.groupName,
          groupColorHex: entry.groupColorHex,
          totalPoints: admin.firestore.FieldValue.increment(entry.points),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  });
});
