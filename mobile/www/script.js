(() => {
  const STORAGE_KEY = "todo-app-items";
  const THEME_KEY = "todo-app-theme";

  const form = document.getElementById("todoForm");
  const input = document.getElementById("todoInput");
  const list = document.getElementById("todoList");
  const emptyState = document.getElementById("emptyState");
  const itemsLeft = document.getElementById("itemsLeft");
  const clearCompletedBtn = document.getElementById("clearCompleted");
  const filterBtns = Array.from(document.querySelectorAll(".filter-btn"));
  const filterPill = document.querySelector(".filter-pill");
  const progressBar = document.getElementById("progressBar");
  const progressLabel = document.getElementById("progressLabel");
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = themeToggle.querySelector(".theme-icon");
  const toast = document.getElementById("toast");

  let todos = loadTodos();
  let filter = "all";
  let toastTimer = null;

  function loadTodos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveTodos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function addTodo(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    todos.unshift({ id: uid(), text: trimmed, completed: false, createdAt: Date.now() });
    saveTodos();
    render({ animateNewId: todos[0].id });
  }

  function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.completed = !todo.completed;
    saveTodos();
    render();
    if (todo.completed && todos.every((t) => t.completed)) {
      showToast("All done! Nice work.");
    }
  }

  function deleteTodo(id) {
    const el = list.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add("removing");
      el.addEventListener(
        "animationend",
        () => {
          todos = todos.filter((t) => t.id !== id);
          saveTodos();
          render();
        },
        { once: true }
      );
    } else {
      todos = todos.filter((t) => t.id !== id);
      saveTodos();
      render();
    }
  }

  function editTodo(id, newText) {
    const trimmed = newText.trim();
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    if (!trimmed) {
      deleteTodo(id);
      return;
    }
    todo.text = trimmed;
    saveTodos();
    render();
  }

  function clearCompleted() {
    const completedEls = list.querySelectorAll(".todo-item.completed");
    if (!completedEls.length) return;
    completedEls.forEach((el) => el.classList.add("removing"));
    setTimeout(() => {
      todos = todos.filter((t) => !t.completed);
      saveTodos();
      render();
      showToast("Completed tasks cleared");
    }, 300);
  }

  function getFiltered() {
    if (filter === "active") return todos.filter((t) => !t.completed);
    if (filter === "completed") return todos.filter((t) => t.completed);
    return todos;
  }

  function checkmarkSVG() {
    return `<svg viewBox="0 0 24 24"><polyline points="4,13 9,18 20,6"></polyline></svg>`;
  }

  function createItemEl(todo, animateNewId) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.completed ? " completed" : "");
    li.dataset.id = todo.id;
    if (todo.id === animateNewId) {
      li.style.animation = "itemIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both";
    }

    const checkbox = document.createElement("button");
    checkbox.className = "checkbox";
    checkbox.type = "button";
    checkbox.setAttribute("aria-label", "Toggle complete");
    checkbox.innerHTML = checkmarkSVG();
    checkbox.addEventListener("click", () => toggleTodo(todo.id));

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text;
    text.title = "Double-click to edit";
    text.addEventListener("dblclick", () => startEdit(text, todo.id));

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "item-btn edit";
    editBtn.type = "button";
    editBtn.innerHTML = "✎";
    editBtn.setAttribute("aria-label", "Edit task");
    editBtn.addEventListener("click", () => startEdit(text, todo.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "item-btn delete";
    deleteBtn.type = "button";
    deleteBtn.innerHTML = "✕";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

    actions.append(editBtn, deleteBtn);
    li.append(checkbox, text, actions);
    return li;
  }

  function startEdit(textEl, id) {
    textEl.contentEditable = "true";
    textEl.focus();
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = () => {
      textEl.contentEditable = "false";
      editTodo(id, textEl.textContent);
    };

    textEl.addEventListener("blur", finish, { once: true });
    textEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        textEl.blur();
      } else if (e.key === "Escape") {
        textEl.textContent = todos.find((t) => t.id === id).text;
        textEl.blur();
      }
    });
  }

  function render(opts = {}) {
    const filtered = getFiltered();
    list.innerHTML = "";
    filtered.forEach((todo) => {
      list.appendChild(createItemEl(todo, opts.animateNewId));
    });

    const total = todos.length;
    const completedCount = todos.filter((t) => t.completed).length;
    const activeCount = total - completedCount;

    emptyState.classList.toggle("show", filtered.length === 0);
    if (total === 0) {
      emptyState.querySelector("span:last-child").textContent = "Nothing here yet. Add your first task!";
    } else if (filtered.length === 0) {
      emptyState.querySelector("span:last-child").textContent = `No ${filter} tasks.`;
    }

    itemsLeft.textContent = `${activeCount} item${activeCount === 1 ? "" : "s"} left`;

    const pct = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    progressBar.style.width = pct + "%";
    progressLabel.textContent = `${completedCount} / ${total} done`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTodo(input.value);
    input.value = "";
    input.focus();
  });

  clearCompletedBtn.addEventListener("click", clearCompleted);

  filterBtns.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      filterBtns.forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      filterPill.style.transform = `translateX(${index * 100}%)`;
      render();
    });
  });

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem(THEME_KEY, theme);
  }

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  initTheme();
  render();
})();
