const STORAGE_KEY = "lifeInWeeks.v1";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = MS_PER_DAY * 7;
const DEFAULT_STATE = {
  version: 1,
  dob: "",
  expectancyYears: 90,
  theme: "void",
  events: [],
};

const TAG_COLORS = {
  life: "#6ea8ff",
  work: "#f77f00",
  family: "#f48fb1",
  health: "#52b788",
  travel: "#9b5de5",
  milestone: "#ffd166",
};

const dom = {
  dobInput: document.getElementById("dob-input"),
  expectancyInput: document.getElementById("expectancy-input"),
  themeBtn: document.getElementById("theme-btn"),
  todayBtn: document.getElementById("today-btn"),
  addEventBtn: document.getElementById("add-event-btn"),
  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  importFile: document.getElementById("import-file"),
  grid: document.getElementById("grid"),
  gridEmpty: document.getElementById("grid-empty"),
  inspectorStatus: document.getElementById("inspector-status"),
  inspectorWeek: document.getElementById("inspector-week"),
  inspectorRange: document.getElementById("inspector-range"),
  inspectorAge: document.getElementById("inspector-age"),
  inspectorStatusText: document.getElementById("inspector-status-text"),
  inspectorEvents: document.getElementById("inspector-events"),
  modal: document.getElementById("event-modal"),
  eventForm: document.getElementById("event-form"),
  eventTitle: document.getElementById("event-title"),
  eventStart: document.getElementById("event-start"),
  eventEnd: document.getElementById("event-end"),
  eventTag: document.getElementById("event-tag"),
  modalError: document.getElementById("modal-error"),
  closeModalBtn: document.getElementById("close-modal-btn"),
  cancelModalBtn: document.getElementById("cancel-modal-btn"),
};

let state = loadState();
let selectedWeek = null;
let saveTimer = null;

init();

function init() {
  dom.expectancyInput.value = state.expectancyYears;
  dom.dobInput.value = state.dob;
  applyTheme(state.theme);
  bindEvents();
  render();
}

function bindEvents() {
  dom.dobInput.addEventListener("change", (event) => {
    state.dob = event.target.value;
    selectedWeek = null;
    persistState();
    render();
  });

  dom.expectancyInput.addEventListener("change", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(value) || value < 1) {
      return;
    }
    state.expectancyYears = Math.min(value, 120);
    persistState();
    render();
  });

  dom.themeBtn.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "void" : "light";
    applyTheme(state.theme);
    persistState();
  });

  dom.todayBtn.addEventListener("click", () => {
    const current = getCurrentWeekIndex();
    if (current === null) {
      return;
    }
    selectWeek(current);
  });

  dom.addEventBtn.addEventListener("click", () => {
    openModal();
  });

  dom.exportBtn.addEventListener("click", () => {
    exportData();
  });

  dom.importBtn.addEventListener("click", () => {
    dom.importFile.click();
  });

  dom.importFile.addEventListener("change", handleImport);

  dom.grid.addEventListener("click", (event) => {
    const weekCell = event.target.closest(".week");
    if (!weekCell) {
      return;
    }
    const index = Number.parseInt(weekCell.dataset.week, 10);
    selectWeek(index);
  });

  document.addEventListener("keydown", (event) => {
    if (!state.dob || dom.modal.classList.contains("open")) {
      return;
    }
    const totalWeeks = getTotalWeeks();
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      moveSelection(event.shiftKey ? 52 : 1, totalWeeks);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      moveSelection(event.shiftKey ? -52 : -1, totalWeeks);
    }
    if (event.key === "Enter" && selectedWeek !== null) {
      openModal();
    }
  });

  dom.closeModalBtn.addEventListener("click", closeModal);
  dom.cancelModalBtn.addEventListener("click", closeModal);
  dom.modal.addEventListener("click", (event) => {
    if (event.target === dom.modal) {
      closeModal();
    }
  });

  dom.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEvent();
  });
}

function render() {
  if (!state.dob) {
    dom.grid.innerHTML = "";
    dom.gridEmpty.hidden = false;
    updateInspector(null);
    return;
  }

  dom.gridEmpty.hidden = true;
  renderGrid();
  const fallbackWeek = getCurrentWeekIndex();
  if (selectedWeek === null && fallbackWeek !== null) {
    selectedWeek = fallbackWeek;
  }
  if (selectedWeek !== null) {
    selectWeek(selectedWeek, { scroll: false });
  }
}

function renderGrid() {
  const totalWeeks = getTotalWeeks();
  const fragment = document.createDocumentFragment();
  const today = startOfDay(new Date());
  const dobDate = parseDate(state.dob);

  dom.grid.innerHTML = "";

  for (let i = 0; i < totalWeeks; i += 1) {
    const weekStart = new Date(dobDate.getTime() + i * MS_PER_WEEK);
    const weekEnd = new Date(weekStart.getTime() + MS_PER_DAY * 6);
    const weekCell = document.createElement("div");
    weekCell.className = "week";
    weekCell.dataset.week = i;
    weekCell.dataset.start = toISODate(weekStart);
    weekCell.dataset.end = toISODate(weekEnd);

    const status = getWeekStatus(weekStart, weekEnd, today);
    weekCell.classList.add(status);

    const overlapping = getOverlappingEvents(weekStart, weekEnd);
    if (overlapping.length > 0) {
      weekCell.classList.add("has-event");
      const eventColor = overlapping[0].color || TAG_COLORS[overlapping[0].tag] || "#6ea8ff";
      weekCell.style.setProperty("--event-color", eventColor);
    }

    fragment.appendChild(weekCell);
  }

  dom.grid.appendChild(fragment);
}

function selectWeek(index, options = {}) {
  const totalWeeks = getTotalWeeks();
  if (index < 0 || index >= totalWeeks) {
    return;
  }
  selectedWeek = index;
  dom.grid.querySelectorAll(".week.selected").forEach((cell) => {
    cell.classList.remove("selected");
  });
  const target = dom.grid.querySelector(`.week[data-week="${index}"]`);
  if (target) {
    target.classList.add("selected");
    if (options.scroll !== false) {
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
  updateInspector(index);
}

function updateInspector(weekIndex) {
  if (weekIndex === null || !state.dob) {
    dom.inspectorStatus.textContent = "Select a week";
    dom.inspectorWeek.textContent = "—";
    dom.inspectorRange.textContent = "—";
    dom.inspectorAge.textContent = "—";
    dom.inspectorStatusText.textContent = "—";
    dom.inspectorEvents.innerHTML = "<span class=\"chip empty\">No events</span>";
    return;
  }

  const dobDate = parseDate(state.dob);
  const weekStart = new Date(dobDate.getTime() + weekIndex * MS_PER_WEEK);
  const weekEnd = new Date(weekStart.getTime() + MS_PER_DAY * 6);
  const today = startOfDay(new Date());
  const status = getWeekStatus(weekStart, weekEnd, today);
  const ageText = formatAge(weekIndex);

  dom.inspectorStatus.textContent = `Week ${weekIndex + 1}`;
  dom.inspectorWeek.textContent = `${weekIndex + 1} of ${getTotalWeeks()}`;
  dom.inspectorRange.textContent = `${toISODate(weekStart)} → ${toISODate(weekEnd)}`;
  dom.inspectorAge.textContent = ageText;
  dom.inspectorStatusText.textContent = capitalize(status);

  const overlapping = getOverlappingEvents(weekStart, weekEnd);
  dom.inspectorEvents.innerHTML = "";
  if (overlapping.length === 0) {
    dom.inspectorEvents.innerHTML = "<span class=\"chip empty\">No events</span>";
  } else {
    overlapping.forEach((event) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = event.title;
      const color = event.color || TAG_COLORS[event.tag] || "#6ea8ff";
      chip.style.borderColor = color;
      chip.style.background = color + "20";
      chip.style.color = color;
      dom.inspectorEvents.appendChild(chip);
    });
  }
}

function getCurrentWeekIndex() {
  if (!state.dob) {
    return null;
  }
  const dobDate = parseDate(state.dob);
  const today = startOfDay(new Date());
  const diff = today.getTime() - dobDate.getTime();
  const index = Math.floor(diff / MS_PER_WEEK);
  if (index < 0) {
    return 0;
  }
  return Math.min(index, getTotalWeeks() - 1);
}

function getTotalWeeks() {
  return state.expectancyYears * 52;
}

function getWeekStatus(start, end, today) {
  if (end.getTime() < today.getTime()) {
    return "past";
  }
  if (start.getTime() <= today.getTime() && end.getTime() >= today.getTime()) {
    return "current";
  }
  return "future";
}

function getOverlappingEvents(weekStart, weekEnd) {
  const weekStartTime = weekStart.getTime();
  const weekEndTime = weekEnd.getTime();
  return state.events.filter((event) => {
    const eventStart = parseDate(event.start).getTime();
    const eventEnd = parseDate(event.end).getTime();
    return eventStart <= weekEndTime && eventEnd >= weekStartTime;
  });
}

function formatAge(weekIndex) {
  const years = Math.floor(weekIndex / 52);
  const remainingWeeks = weekIndex % 52;
  const months = Math.floor(remainingWeeks / 4);
  const weeks = remainingWeeks % 4;
  const parts = [];
  if (years > 0) {
    parts.push(`${years}y`);
  }
  if (months > 0 || years > 0) {
    parts.push(`${months}m`);
  }
  parts.push(`${weeks}w`);
  return parts.join(" ");
}

function moveSelection(delta, totalWeeks) {
  if (selectedWeek === null) {
    selectedWeek = getCurrentWeekIndex() ?? 0;
  }
  const next = Math.min(Math.max(selectedWeek + delta, 0), totalWeeks - 1);
  selectWeek(next);
}

function openModal() {
  if (!state.dob) {
    dom.modalError.textContent = "Set your date of birth first.";
  } else {
    dom.modalError.textContent = "";
  }
  dom.eventForm.reset();
  if (selectedWeek !== null && state.dob) {
    const dobDate = parseDate(state.dob);
    const weekStart = new Date(dobDate.getTime() + selectedWeek * MS_PER_WEEK);
    const weekEnd = new Date(weekStart.getTime() + MS_PER_DAY * 6);
    dom.eventStart.value = toISODate(weekStart);
    dom.eventEnd.value = toISODate(weekEnd);
  }
  dom.modal.classList.add("open");
  dom.modal.setAttribute("aria-hidden", "false");
  dom.eventTitle.focus();
}

function closeModal() {
  dom.modal.classList.remove("open");
  dom.modal.setAttribute("aria-hidden", "true");
  dom.modalError.textContent = "";
}

function saveEvent() {
  if (!state.dob) {
    dom.modalError.textContent = "Set your date of birth before adding events.";
    return;
  }
  const title = dom.eventTitle.value.trim();
  const start = dom.eventStart.value;
  const end = dom.eventEnd.value;
  if (!title) {
    dom.modalError.textContent = "Title is required.";
    return;
  }
  if (!start || !end) {
    dom.modalError.textContent = "Start and end dates are required.";
    return;
  }
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (endDate.getTime() < startDate.getTime()) {
    dom.modalError.textContent = "End date must be on or after start date.";
    return;
  }

  const newEvent = {
    id: `evt_${Date.now()}`,
    title,
    start,
    end,
    tag: dom.eventTag.value,
  };

  state.events.push(newEvent);
  persistState();
  renderGrid();
  updateInspector(selectedWeek);
  closeModal();
}

function exportData() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "life-in-weeks.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!isValidState(parsed)) {
        alert("Invalid file format.");
        return;
      }
      state = normalizeState(parsed);
      dom.dobInput.value = state.dob;
      dom.expectancyInput.value = state.expectancyYears;
      applyTheme(state.theme);
      persistState();
      selectedWeek = null;
      render();
    } catch (error) {
      alert("Unable to read file.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { ...DEFAULT_STATE };
  }
  try {
    const parsed = JSON.parse(saved);
    if (!isValidState(parsed)) {
      return { ...DEFAULT_STATE };
    }
    return normalizeState(parsed);
  } catch (error) {
    return { ...DEFAULT_STATE };
  }
}

function normalizeState(data) {
  return {
    version: 1,
    dob: data.dob || "",
    expectancyYears: data.expectancyYears || 90,
    theme: data.theme === "light" ? "light" : "void",
    events: Array.isArray(data.events) ? data.events : [],
  };
}

function isValidState(data) {
  if (!data || data.version !== 1) {
    return false;
  }
  if (typeof data.expectancyYears !== "number") {
    return false;
  }
  if (!Array.isArray(data.events)) {
    return false;
  }
  return true;
}

function persistState() {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, 150);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
