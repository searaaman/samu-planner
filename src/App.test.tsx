import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App, { QUOTES, avgClock, blockOf, duration, nextQuote, normalise, ymd } from "./App";

const KEY = "samu-planner-v1";
window.scrollTo = () => {}; // jsdom has no layout
const nav = (label: string) => fireEvent.click(within(document.querySelector(".sidebar") as HTMLElement).getByRole("button", { name: label }));
const type = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const addTask = (title: string, due?: string) => {
  nav("Tasks"); type("What do you have to do?", title);
  if (due) set("Finish by", due);
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
};

beforeEach(() => { localStorage.clear(); history.replaceState(null, "", "/"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("helpers", () => {
  it("runs in IST", () => expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-330));
  it("ymd gives the local date just after midnight", () => expect(ymd(new Date(2026, 0, 2, 0, 15))).toBe("2026-01-02"));
  it("notes are distinct, signed for Samu, and wrap round", () => {
    expect(new Set(QUOTES).size).toBe(QUOTES.length);
    expect(QUOTES.join(" ")).not.toMatch(/Meghna|Megha|Jishnu|Chinnu|CA\b/);
    expect(nextQuote({ i: QUOTES.length - 1, day: "x" }, "y").i).toBe(0);
  });
  it("duration runs past midnight", () => {
    expect(duration("09:00", "10:30")).toBe(90);
    expect(duration("23:30", "07:00")).toBe(450);
  });
  it("avgClock averages round the clock", () => {
    expect(avgClock(["23:30", "00:30"])).toBe("00:00");
    expect(avgClock(["07:00", "08:00"])).toBe("07:30");
    expect(avgClock([])).toBe("");
  });
  it("blockOf puts late night in Night", () => {
    expect([blockOf(6), blockOf(13), blockOf(18), blockOf(23), blockOf(2)]).toEqual(["Morning", "Afternoon", "Evening", "Night", "Night"]);
  });
  it("normalise drops bad items and non-image photos", () => {
    const s = normalise({ photo: "javascript:x", tasks: [null, { id: "a", title: "ok", due: "", doneAt: "" }, { id: 1 }], entries: "no" });
    // an old task without category/priority is kept, with defaults
    expect(s).toEqual({ photo: "", tasks: [{ id: "a", title: "ok", due: "", doneAt: "", category: "", priority: "Medium" }], entries: [] });
    expect(normalise(null)).toEqual({ photo: "", tasks: [], entries: [] });
  });
});

describe("app", () => {
  it.each([["Tasks", "Tasks"], ["Ledger", "Ledger"], ["Settings", "Settings"], ["Dashboard", "Hi, Samu"]])("%s renders", (label, heading) => {
    render(<App />); nav(label);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
  });

  it("tasks: add, tick, untick, delete; old undone tasks are left behind", () => {
    render(<App />);
    addTask("Buy flowers");
    addTask("Call bank", "2020-01-01");
    expect(screen.getByText("Left behind")).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Mark "Buy flowers" done'));
    expect(JSON.parse(localStorage.getItem(KEY)!).tasks[0].doneAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/);
    fireEvent.click(screen.getByLabelText('Mark "Buy flowers" not done'));
    expect(JSON.parse(localStorage.getItem(KEY)!).tasks[0].doneAt).toBe("");
    fireEvent.click(screen.getAllByTitle("Delete task").at(-1)!); // "Buy flowers": dated today, so after the older task
    expect(JSON.parse(localStorage.getItem(KEY)!).tasks).toHaveLength(1);
    nav("Dashboard");
    expect(screen.getByText("Call bank")).toBeTruthy(); // in the Left behind panel
  });

  it("tasks: category and priority are saved; same end date sorts High first", () => {
    render(<App />);
    addTask("Low one");
    nav("Tasks"); type("What do you have to do?", "Urgent one"); type("e.g. Work, Home, Shopping", " Work "); set("Priority", "High");
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    const t = JSON.parse(localStorage.getItem(KEY)!).tasks[1];
    expect([t.category, t.priority]).toEqual(["Work", "High"]);
    const rows = [...document.querySelectorAll(".topic-row b")].map(b => b.textContent);
    expect(rows.slice(0, 2)).toEqual(["Urgent one", "Low one"]);
    expect(screen.getByText(/^Work · Finish by today$/)).toBeTruthy();
  });

  it("ledger: logs sleep across midnight and the dashboard shows it", () => {
    render(<App />);
    nav("Ledger");
    set("Kind", "Sleep"); set("From", "23:30"); set("To", "07:00");
    fireEvent.click(screen.getByRole("button", { name: "Add to ledger" }));
    expect(screen.getAllByText("7h 30m").length).toBeGreaterThan(0);
    nav("Dashboard");
    expect(screen.getByText("23:30")).toBeTruthy(); // usual bedtime
    nav("Ledger");
    fireEvent.click(screen.getByTitle("Delete entry"));
    expect(JSON.parse(localStorage.getItem(KEY)!).entries).toHaveLength(0);
  });

  it("recovers from corrupt saved data and keeps a copy", () => {
    localStorage.setItem(KEY, "{oops");
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Hi, Samu" })).toBeTruthy();
    expect(localStorage.getItem(`${KEY}-unreadable`)).toBe("{oops");
  });

  it("restores a backup and rejects a bad one", async () => {
    const { container } = render(<App />);
    const restore = (content: string) => fireEvent.change(container.querySelector('input[accept="application/json"]')!, { target: { files: [new File([content], "b.json")] } });
    restore(JSON.stringify({ photo: "", tasks: [{ id: "t", title: "Restored task", due: "", doneAt: "" }], entries: [] }));
    expect(await screen.findByText("Backup restored")).toBeTruthy();
    nav("Tasks");
    expect(screen.getByText("Restored task")).toBeTruthy();
    restore('{"foo":1}');
    expect(await screen.findByText("That file is not a valid app backup")).toBeTruthy();
    expect(screen.getByText("Restored task")).toBeTruthy();
  });

  it("reset clears data only after confirmation", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    addTask("Keep me");
    nav("Settings");
    fireEvent.click(screen.getByRole("button", { name: /Reset this browser's data/ }));
    expect(JSON.parse(localStorage.getItem(KEY)!).tasks).toHaveLength(1);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Reset this browser's data/ }));
    expect(JSON.parse(localStorage.getItem(KEY)!).tasks).toHaveLength(0);
  });
});
