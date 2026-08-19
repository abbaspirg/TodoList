import { el, mount } from "../util.js";
import { watchItem, watchRegistrations, watchScoresByJudge, submitScore } from "../data.js";
import { FEST_ID } from "../app-config.js";
import { currentUserId } from "../auth.js";

const DEFAULT_MAX_SCORE = 10;

export async function renderJudgeScoring({ itemId }) {
  const listHost = el("div", {});
  mount(el("div", {}, [el("h1", { class: "page-title" }, "Score Participants"), listHost]));

  let maxScore = DEFAULT_MAX_SCORE;
  let registrations = [];
  let submittedByRegId = new Map();
  const judgeId = currentUserId() || "";

  function render() {
    listHost.replaceChildren(
      ...registrations.map((reg) =>
        renderParticipantCard(reg, maxScore, submittedByRegId.get(reg.id), judgeId, itemId),
      ),
    );
  }

  watchItem(FEST_ID, itemId, (item) => {
    maxScore = item?.maxScore || DEFAULT_MAX_SCORE;
    render();
  });
  watchRegistrations(itemId, (regs) => {
    registrations = regs;
    render();
  });
  watchScoresByJudge(itemId, judgeId, (scores) => {
    submittedByRegId = new Map(scores.map((s) => [s.registrationId, s]));
    render();
  });
}

function renderParticipantCard(reg, maxScore, existingScore, judgeId, itemId) {
  const locked = Boolean(existingScore);
  let mark = existingScore?.totalMarks ?? Math.round(maxScore / 2);

  const valueLabel = el("span", { class: "value" }, String(mark));
  const slider = el("input", {
    type: "range",
    min: "0",
    max: String(maxScore),
    value: String(mark),
    disabled: locked || undefined,
    oninput: (e) => {
      mark = Number(e.target.value);
      valueLabel.textContent = e.target.value;
    },
  });

  const submitBtn = el(
    "button",
    {
      class: "btn",
      disabled: locked || undefined,
      onclick: async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting…";
        try {
          await submitScore({ festId: FEST_ID, itemId, registrationId: reg.id, judgeId, totalMarks: mark, maxScore });
        } finally {
          submitBtn.textContent = "Submitted";
        }
      },
    },
    locked ? "Submitted" : "Submit",
  );

  return el("div", { class: "card" }, [
    el("div", { class: "btn-row", style: "align-items:center;justify-content:space-between" }, [
      el("span", {}, [
        el("strong", {}, `#${reg.chestNumber} `),
        reg.studentName,
      ]),
      locked ? el("span", {}, "🔒") : null,
    ]),
    el("div", { class: "slider-row" }, [
      el("label", {}, `Score (out of ${maxScore})`),
      slider,
      valueLabel,
    ]),
    el("div", { class: "btn-row", style: "justify-content:flex-end;margin-top:8px" }, [submitBtn]),
  ]);
}
