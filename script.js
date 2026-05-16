const RESULTS_API_URL = "https://script.google.com/macros/s/AKfycbyby7nOGMZe-w8pph0IZ7jz9WqQ17pwFhfW4TdWgoi1PJlkvXhYuNzHav48WBNsOkcGjg/exec";

const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const taskList = document.querySelector("#taskList");
const pickButton = document.querySelector("#pickButton");
const clearButton = document.querySelector("#clearButton");
const pickedTask = document.querySelector("#pickedTask");

const tasks = [];

function renderTasks() {
  taskList.innerHTML = "";

  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.textContent = task;
    taskList.appendChild(item);
  });
}

function buildTaskLabel(row) {
  const name = row.Name || row.name || "";
  const date = row.Date || row.date || "";
  const userId = row["User ID"] || row.userId || "";
  const totalPick = row["Total pick"] || row["Total Pick"] || "";

  const details = [
    name,
    date && `Date: ${date}`,
    userId && `User ID: ${userId}`,
    totalPick && `Total pick: ${totalPick}`,
  ].filter(Boolean);

  return details.join(" | ");
}

async function loadTasksFromSheet() {
  pickedTask.textContent = "กำลังโหลดข้อมูลจาก Results Master...";

  try {
    const response = await fetch(RESULTS_API_URL);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const sheetTasks = rows
      .map(buildTaskLabel)
      .filter(Boolean);

    tasks.length = 0;
    tasks.push(...sheetTasks);
    renderTasks();

    pickedTask.textContent = tasks.length
      ? `โหลดข้อมูลจาก Sheet แล้ว ${tasks.length} รายการ`
      : "ยังไม่มีข้อมูลจาก Sheet";
  } catch (error) {
    console.error(error);
    pickedTask.textContent = "โหลดข้อมูลจาก Sheet ไม่ได้ ตอนนี้เพิ่มงานเองก่อนได้";
  }
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const task = taskInput.value.trim();

  if (!task) {
    return;
  }

  tasks.push(task);
  taskInput.value = "";
  pickedTask.textContent = "เพิ่มงานแล้ว เลือกต่อได้เลย";
  renderTasks();
});

pickButton.addEventListener("click", () => {
  if (tasks.length === 0) {
    pickedTask.textContent = "เพิ่มงานก่อน แล้วค่อยสุ่มเลือก";
    return;
  }

  const index = Math.floor(Math.random() * tasks.length);
  pickedTask.textContent = `เริ่มจาก: ${tasks[index]}`;
});

clearButton.addEventListener("click", () => {
  tasks.length = 0;
  pickedTask.textContent = "ล้างรายการแล้ว";
  renderTasks();
});

loadTasksFromSheet();
