const YEARS = 90;
const WEEKS_PER_YEAR = 52;
const TOTAL_WEEKS = YEARS * WEEKS_PER_YEAR;

const grid = document.getElementById("week-grid");
const overlay = document.getElementById("overlay");
const dobInput = document.getElementById("dob");
const enterButton = document.getElementById("enter");
const dobError = document.getElementById("dob-error");
const changeDateButton = document.querySelector(".change-date");

const hudRange = document.getElementById("hud-range");
const hudAge = document.getElementById("hud-age");
const hudState = document.getElementById("hud-state");

let currentCell = null;
let selectedCell = null;
let currentIndex = 0;
let dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
});

const today = normalizeDate(new Date());

function normalizeDate(date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

function alignToMonday(date) {
  const aligned = normalizeDate(date);
  const day = aligned.getDay();
  const diff = (day + 6) % 7;
  aligned.setDate(aligned.getDate() - diff);
  return aligned;
}

function formatRange(startDate, endDate) {
  return `${dateFormatter.format(startDate)} — ${dateFormatter.format(endDate)}`;
}

function formatAge(index) {
  const years = Math.floor(index / WEEKS_PER_YEAR);
  const weeks = index % WEEKS_PER_YEAR;
  return `Age: ${years}y ${weeks}w`;
}

function setHud(cell, state) {
  if (!cell) {
    hudRange.textContent = "—";
    hudAge.textContent = "—";
    hudState.textContent = "—";
    return;
  }

  hudRange.textContent = cell.dataset.range;
  hudAge.textContent = cell.dataset.age;
  hudState.textContent = state;
}

function updateHudForCell(cell) {
  if (!cell) {
    setHud(currentCell, currentCell?.dataset.state || "");
    return;
  }
  setHud(cell, cell.dataset.state);
}

function clearHover() {
  const hovered = grid.querySelector(".week-cell.is-hovered");
  if (hovered) {
    hovered.classList.remove("is-hovered");
  }
}

function clearSelection() {
  if (selectedCell) {
    selectedCell.classList.remove("is-selected");
    selectedCell = null;
  }
}

function buildGrid(dob) {
  grid.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const alignedDob = alignToMonday(dob);

  currentCell = null;
  selectedCell = null;
  currentIndex = 0;

  for (let index = 0; index < TOTAL_WEEKS; index += 1) {
    const startDate = new Date(alignedDob);
    startDate.setDate(alignedDob.getDate() + index * 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const cell = document.createElement("div");
    cell.className = "week-cell";
    cell.dataset.index = index;
    cell.dataset.start = startDate.toISOString();
    cell.dataset.end = endDate.toISOString();
    cell.dataset.range = formatRange(startDate, endDate);
    cell.dataset.age = formatAge(index);

    let state = "future";
    if (endDate < today) {
      state = "past";
    } else if (startDate <= today && endDate >= today) {
      state = "current";
      currentCell = cell;
      currentIndex = index;
    }

    cell.dataset.state = state;
    cell.classList.add(state);

    fragment.appendChild(cell);
  }

  if (!currentCell) {
    currentCell = fragment.lastChild;
    currentIndex = TOTAL_WEEKS - 1;
    currentCell.dataset.state = "current";
    currentCell.classList.remove("future");
    currentCell.classList.add("current");
  }

  grid.appendChild(fragment);
  setHud(currentCell, currentCell.dataset.state);
}

function validateDob() {
  dobError.textContent = "";
  const value = dobInput.value;
  if (!value) {
    enterButton.disabled = true;
    return;
  }
  const selectedDate = normalizeDate(new Date(value));
  if (Number.isNaN(selectedDate.getTime())) {
    enterButton.disabled = true;
    return;
  }
  if (selectedDate > today) {
    dobError.textContent = "Birth date cannot be in the future.";
    enterButton.disabled = true;
    return;
  }
  enterButton.disabled = false;
}

function handleEnter() {
  const value = dobInput.value;
  if (!value) {
    return;
  }
  const selectedDate = normalizeDate(new Date(value));
  if (selectedDate > today) {
    dobError.textContent = "Birth date cannot be in the future.";
    return;
  }

  buildGrid(selectedDate);
  overlay.classList.add("hidden");
}

function showOverlay() {
  overlay.classList.remove("hidden");
  clearSelection();
  clearHover();
  dobInput.focus();
}

function handlePointerOver(event) {
  if (event.pointerType && event.pointerType !== "mouse") {
    return;
  }
  const cell = event.target.closest(".week-cell");
  if (!cell || cell === selectedCell) {
    return;
  }
  clearHover();
  cell.classList.add("is-hovered");
  updateHudForCell(cell);
}

function handlePointerOut(event) {
  if (event.pointerType && event.pointerType !== "mouse") {
    return;
  }
  const cell = event.target.closest(".week-cell");
  if (!cell) {
    return;
  }
  cell.classList.remove("is-hovered");
  updateHudForCell(selectedCell || currentCell);
}

function handleClick(event) {
  const cell = event.target.closest(".week-cell");
  if (!cell) {
    return;
  }
  if (selectedCell === cell) {
    clearSelection();
    updateHudForCell(currentCell);
    return;
  }
  clearSelection();
  clearHover();
  selectedCell = cell;
  selectedCell.classList.add("is-selected");
  updateHudForCell(selectedCell);
}

function init() {
  dobInput.max = new Date().toISOString().split("T")[0];
  dobInput.addEventListener("input", validateDob);
  enterButton.addEventListener("click", handleEnter);
  changeDateButton.addEventListener("click", showOverlay);

  grid.addEventListener("pointerover", handlePointerOver);
  grid.addEventListener("pointerout", handlePointerOut);
  grid.addEventListener("click", handleClick);

  validateDob();
}

init();
