import { el, mount } from "../util.js";
import { watchItem, watchRegistrations, watchScoresByJudge, submitScore } from "../data.js";
import { FEST_ID } from "../firebase-config.js";
import { currentUserId } from "../auth.js";

const DEFAULT_CRITERIA = ["Voice", "Pronunciation", "Presentation"];

export async function renderJudgeScoring({ itemId }) {
  const listHost = el("div", {});
  mount(el("div", {}, [el("h1", { class: "page-title" }, "Score Participants"), listHost]));

  let criteria = DEFAULT_CRITERIA;
  let registrations = [];
  let submittedByRegId = new Map();
  const judgeId = currentUserId() || "";

  function render() {
    listHost.replaceChildren(
      ...registrations.map((reg) => renderParticipantCard(reg, criteria, submittedByRegId.get(reg.id), judgeId, itemId)),
    );
  }

  watchItem(FEST_ID, itemId, (item) => {
    criteria = item?.scoringCriteria || DEFAULT_CRITERIA;
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

function renderParticipantCard(reg, criteria, existingScore, judgeId, itemId) {
  const locked = Boolean(existingScore);
  const marks = {};
  const valueLabels = {};

  const sliderRows = criteria.map((criterion) => {
    marks[criterion] = existingScore?.criteriaMarks?.[criterion] ?? 5;
    const valueLabel = el("span", { class: "value" }, String(marks[criterion]));
    valueLabels[criterion] = valueLabel;
    const slider = el("input", {
      type: "range",
      min: "0",
      max: "10",
      value: String(marks[criterion]),
      disabled: locked || undefined,
      oninput: (e) => {
        marks[criterion] = Number(e.target.value);
        valueLabel.textContent = e.target.value;
        totalLabel.textContent = `Total: ${Object.values(marks).reduce((a, b) => a + b, 0)}`;
      },
    });
    return el("div", { class: "slider-row" }, [el("label", {}, criterion), slider, valueLabel]);
  });

  const totalLabel = el(
    "strong",
    {},
    `Total: ${Object.values(marks).reduce((a, b) => a + b, 0)}`,
  );

  const submitBtn = el(
    "button",
    {
      class: "btn",
      disabled: locked || undefined,
      onclick: async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting…";
        try {
          await submitScore({
            itemId,
            registrationId: reg.id,
            judgeId,
            criteriaMarks: marks,
            totalMarks: Object.values(marks).reduce((a, b) => a + b, 0),
          });
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
    ...sliderRows,
    el("div", { class: "btn-row", style: "justify-content:space-between;align-items:center;margin-top:8px" }, [
      totalLabel,
      submitBtn,
    ]),
  ]);
}
