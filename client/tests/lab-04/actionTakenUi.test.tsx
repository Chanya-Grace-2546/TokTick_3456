import { describe, expect, it } from "vitest";
import { actionDraft, actionInput, actionPatch, actionStates, localActionTime, validateActionDraft } from "../../src/actionTakenUi.js";
import { action } from "./helpers/actionFixture.js";
describe("Action UI rules (AC-03/06/07/39)", () => {
  it.each(["COMPLETED", "CANCELLED"] as const)("does not offer exits from %s", state => expect(actionStates(state)).toEqual([state]));
  it("offers unchanged state and only forward transitions", () => {
    expect(actionStates("IN_PROGRESS")).toEqual(["IN_PROGRESS", "COMPLETED", "CANCELLED"]);
    expect(actionStates("PLANNED")).toEqual(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
  });
  it("round-trips local datetime as UTC", () => expect(new Date(localActionTime(action.actionAt)).toISOString()).toBe(action.actionAt));
  it("requires only contract fields and enforces result limits", () => {
    const draft = actionDraft(action);
    expect(validateActionDraft({ ...draft, description: " ", followUpNote: " " })).toMatchObject({ description: expect.any(String), followUpNote: expect.any(String) });
    expect(validateActionDraft({ ...draft, state: "COMPLETED", result: " " })).toHaveProperty("result");
    expect(validateActionDraft({ ...draft, result: "x".repeat(2001) })).toHaveProperty("result");
    expect(validateActionDraft({ ...draft, actionAt: "" })).toHaveProperty("actionAt");
  });
  it("allows completion with outstanding documented follow-up, and preserves notes when cleared", () => {
    const draft = { ...actionDraft(action), state: "COMPLETED" as const };
    expect(validateActionDraft(draft)).toEqual({});
    expect(actionInput({ ...draft, followUpRequired: false })).toMatchObject({ followUpRequired: false, followUpNote: "Check tomorrow" });
  });
  it("does not invent description/note limits or send protected fields", () => {
    const draft = { ...actionDraft(), description: "x".repeat(10000) };
    expect(validateActionDraft(draft)).toEqual({});
    expect(actionInput(draft)).toMatchObject({ assignedToUserId: null, result: null });
    expect(actionInput(draft)).not.toHaveProperty("performedByUserId");
    expect(actionInput(draft)).not.toHaveProperty("version");
  });
  it("preserves millisecond precision and omits unchanged PATCH fields", () => {
    const original = { ...action, actionAt: "2026-10-22T10:30:00.123Z" };
    const draft = actionDraft(original);
    expect(new Date(draft.actionAt).toISOString()).toBe(original.actionAt);
    expect(actionPatch({ ...draft, description: "Edited only" }, original)).toEqual({ description: "Edited only" });
    const changed = { ...draft, actionAt: draft.actionAt.replace(".123", ".456") };
    expect(actionPatch(changed, original)).toEqual({ actionAt: "2026-10-22T10:30:00.456Z" });
  });

});
