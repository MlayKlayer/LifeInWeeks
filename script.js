const YEARS = 90;
const TOTAL_WEEKS = YEARS * 52;

const overlay = document.getElementById("overlay");
const app = document.getElementById("app");
const grid = document.getElementById("grid");
const dobInput = document.getElementById("dob");
const enterButton = document.getElementById("enter");
const errorMessage = document.getElementById("dob-error");
const changeDateLink = document.getElementById("change-date");
const hudRange = document.getElementById("hud-range");
const hudAge = document.getElementById("hud-age");
const hudIndex = document.getElementById("hud-index");

const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const formatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
});

const state = {
  dob: null,
  alignedDob: null,
  currentIndex: null,
  selectedIndex: null,
  hoveredIndex: null,
};

const today = () => {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return now;
};

const alignToMonday = (date) => {
  const aligned = new Date(date);
  aligned.setHours(12, 0, 0, 0);
  const day = aligned.getDay();
  const diff = (day + 6) % 7;
  aligned.setDate(aligned.getDate() - diff);
  return aligned;
};

const formatRange = (startMs, endMs) => {
  const start = new Date(Number(startMs));
  const end = new Date(Number(endMs));
  return `${formatter.format(start)} — ${formatter.format(end)}`;
};

const formatAge = (index) => {
  const years = Math.floor(index / 52);
  const weeks = index % 52;
  return `Age: ${years}y ${weeks}w`;
};

const updateHud = (cell) => {
  if (!cell) {
    hudRange.textContent = "—";
    hudAge.textContent = "Age: —";
    hudIndex.textContent = "Week: —";
    return;
  }
  hudRange.textContent = formatRange(cell.dataset.start, cell.dataset.end);
  hudAge.textContent = formatAge(Number(cell.dataset.index));
  hudIndex.textContent = `Week: ${Number(cell.dataset.index) + 1} / ${TOTAL_WEEKS}`;
};

const clearHover = () => {
  if (state.hoveredIndex !== null) {
    const previous = grid.querySelector(`[data-index="${state.hoveredIndex}"]`);
    if (previous) previous.classList.remove("hovered");
    state.hoveredIndex = null;
  }
};

const setHover = (cell) => {
  if (state.selectedIndex !== null) return;
  if (state.hoveredIndex === Number(cell.dataset.index)) return;
  clearHover();
  cell.classList.add("hovered");
  state.hoveredIndex = Number(cell.dataset.index);
  updateHud(cell);
};

const setSelected = (cell) => {
  if (state.selectedIndex !== null) {
    const previous = grid.querySelector(`[data-index="${state.selectedIndex}"]`);
    if (previous) previous.classList.remove("selected");
  }
  state.selectedIndex = Number(cell.dataset.index);
  cell.classList.add("selected");
  updateHud(cell);
};

const clearSelected = () => {
  if (state.selectedIndex !== null) {
    const previous = grid.querySelector(`[data-index="${state.selectedIndex}"]`);
    if (previous) previous.classList.remove("selected");
  }
  state.selectedIndex = null;
  const current = grid.querySelector(`[data-index="${state.currentIndex}"]`);
  updateHud(current);
};

const buildGrid = (alignedDob) => {
  grid.innerHTML = "";
  state.currentIndex = null;
  state.selectedIndex = null;
  state.hoveredIndex = null;

  const fragment = document.createDocumentFragment();
  const now = today().getTime();

  for (let i = 0; i < TOTAL_WEEKS; i += 1) {
    const startDate = new Date(alignedDob);
    startDate.setDate(alignedDob.getDate() + i * 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = String(i);
    cell.dataset.start = String(startDate.getTime());
    cell.dataset.end = String(endDate.getTime());

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    if (endMs < now) {
      cell.classList.add("past");
    } else if (startMs <= now && endMs >= now) {
      cell.classList.add("current");
      state.currentIndex = i;
    } else {
      cell.classList.add("future");
    }

    fragment.appendChild(cell);
  }

  if (state.currentIndex === null) {
    const lastIndex = TOTAL_WEEKS - 1;
    const lastCell = fragment.childNodes[lastIndex];
    if (lastCell) {
      lastCell.classList.add("current");
      state.currentIndex = lastIndex;
    }
  }

  grid.appendChild(fragment);

  const current = grid.querySelector(`[data-index="${state.currentIndex}"]`);
  updateHud(current);
};

const showApp = () => {
  overlay.classList.add("hidden");
  app.classList.add("active");
  app.setAttribute("aria-hidden", "false");
};

const showOverlay = () => {
  overlay.classList.remove("hidden");
  app.classList.remove("active");
  app.setAttribute("aria-hidden", "true");
};

const validateDob = () => {
  const value = dobInput.value;
  enterButton.disabled = !value;
  errorMessage.textContent = "";
  if (!value) return null;
  const selected = new Date(`${value}T12:00:00`);
  if (Number.isNaN(selected.getTime())) return null;
  if (selected.getTime() > today().getTime()) {
    errorMessage.textContent = "Date of birth cannot be in the future.";
    enterButton.disabled = true;
    return null;
  }
  return selected;
};

const handleSubmit = (event) => {
  event.preventDefault();
  const selected = validateDob();
  if (!selected) return;
  state.dob = selected;
  state.alignedDob = alignToMonday(selected);
  buildGrid(state.alignedDob);
  showApp();
};

const handleHover = (event) => {
  if (!hoverCapable) return;
  if (state.selectedIndex !== null) return;
  const cell = event.target.closest(".cell");
  if (!cell) return;
  setHover(cell);
};

const handlePointerLeave = () => {
  if (!hoverCapable) return;
  if (state.selectedIndex !== null) return;
  clearHover();
  const current = grid.querySelector(`[data-index="${state.currentIndex}"]`);
  updateHud(current);
};

const handleSelect = (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const index = Number(cell.dataset.index);
  if (state.selectedIndex === index) {
    clearSelected();
    return;
  }
  setSelected(cell);
};

dobInput.addEventListener("input", validateDob);

document.getElementById("intro-form").addEventListener("submit", handleSubmit);

grid.addEventListener("pointerover", handleHover);

grid.addEventListener("pointerleave", handlePointerLeave);

grid.addEventListener("click", handleSelect);

changeDateLink.addEventListener("click", (event) => {
  event.preventDefault();
  showOverlay();
});
