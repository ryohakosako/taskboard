let tasks = {
    children: [],
};
let activeColumnId = "column-1";
let boardSortables = [];
let nextId = 1;
let nextChecklistId = 1;
let selectedTaskId = null;
let showChecklistInput = false;
let editingChecklistId = null;
let editingOldText = "";
let cancelEditing = false;
let checklistSortable = null;
let editingCursorOffset = null;

const undoHistory = [];
const redoHistory = [];
let savedSnapshot = null;

function saveData() {
    normalizeColumns(tasks);
    const snapshot = JSON.stringify(tasks);
    if (savedSnapshot !== null && snapshot !== savedSnapshot) {
        undoHistory.push(savedSnapshot);
        redoHistory.length = 0;
    }
    localStorage.setItem("creativeTasks", snapshot);
    savedSnapshot = snapshot;
}

function restoreHistory(from, to) {
    if (!from.length) return;
    to.push(savedSnapshot);
    tasks = JSON.parse(from.pop());
    savedSnapshot = JSON.stringify(tasks);
    localStorage.setItem("creativeTasks", savedSnapshot);
    normalizeColumns(tasks);
    recalculateIds();
    editingChecklistId = null;
    showChecklistInput = false;
    renderTree();
}

document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey || event.altKey || event.isComposing ||
        event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") ||
        document.getElementById("deleteConfirmation").open) return;
    const key = event.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    event.preventDefault();
    if (key === "z") restoreHistory(undoHistory, redoHistory);
    else restoreHistory(redoHistory, undoHistory);
});

let pendingDeletion = null;
let deletionTrigger = null;
function confirmDeletion(action) {
    pendingDeletion = action;
    deletionTrigger = document.activeElement;
    document.getElementById("deleteConfirmation").showModal();
    document.getElementById("cancelDeleteButton").focus();
}

function cancelDeletion() {
    pendingDeletion = null;
    document.getElementById("deleteConfirmation").close();
    if (deletionTrigger?.isConnected) deletionTrigger.focus();
}

document.getElementById("cancelDeleteButton").addEventListener("click", cancelDeletion);
document.getElementById("deleteConfirmation").addEventListener("cancel", (event) => {
    event.preventDefault();
    cancelDeletion();
});
document.getElementById("confirmDeleteButton").addEventListener("click", () => {
    const action = pendingDeletion;
    cancelDeletion();
    action?.();
});

// データ処理

function getProgress(task) {
    if (!task.checklist || task.checklist.length === 0) {
        return 0;
    }
    const doneCount = task.checklist.filter((item) => item.done).length;
    return Math.round((doneCount / task.checklist.length) * 100);
}

function findTask(task, id) {
    return task.children.find((child) => child.id == id) || null;
}

function saveChecklistEdit(input, selectedTask, shouldRender = true) {
    const id = Number(input.dataset.id);

    const item = selectedTask.checklist.find((c) => c.id === id);

    if (!item) {
        return;
    }

    item.text = input.value.trim();

    saveData();

    editingChecklistId = null;

    if (shouldRender) {
        renderTree();
    }
}

// HTML生成

function getNextChecklist(task, count = 2) {
    return task.checklist.filter((item) => !item.done).slice(0, count);
}

function createTaskList(columnId) {
    let html = "";

    for (const task of tasks.children.filter(task => task.columnId === columnId)) {
        const progress = getProgress(task);

        const selectedClass = task.id === selectedTaskId ? "selected" : "";

        const nextItems = getNextChecklist(task);

        const item = nextItems[0];

        const nextHtml =
            item
                ? `
            <span
                class="taskCheckItem"
                data-task-id="${task.id}"
                data-check-id="${item.id}">

                <span class="taskCheckMark">□</span>

                <span class="taskCheckText">
                    ${escapeHtml(item.text)}
                </span>

            </span>
        `
                : "";

        html += `
        <div
            class="task ${selectedClass}"
            data-id="${task.id}"
            style="--progress: ${progress}%">

            <span class="taskTitle">
                ${escapeHtml(task.name)}
            </span>

            <span class="taskChecks">
                ${nextHtml}
            </span>

            <span class="taskProgress">
                ${progress}%
            </span>

        </div>
        `;
    }

    return html;
}

function renderTaskDetail(selectedTask) {
    const progress = getProgress(selectedTask);

    const totalCount = selectedTask.checklist.length;

    const doneCount = selectedTask.checklist.filter((item) => item.done).length;

    document.getElementById("checklistProgress").textContent = `${progress}%  ${doneCount}/${totalCount}`;

    document.getElementById("taskNameView").innerHTML = `
        <input
            id="taskNameInput"
            value="${escapeHtml(selectedTask.name)}"
        >
        `;

    document.getElementById("taskDescriptionView").innerHTML = `
    <textarea id="taskDescriptionInput">${escapeHtml(selectedTask.description)}</textarea>
`;

    const descriptionInput = document.getElementById("taskDescriptionInput");

    descriptionInput.addEventListener("keydown", function (event) {

        if (event.key === "Enter") {
            const modalContent = document.querySelector(".modalContent");
            const scrollTop = modalContent.scrollTop;

            requestAnimationFrame(() => {
                modalContent.scrollTop = scrollTop;
            });
        }
    });

    function resizeDescription() {
        const modalContent = document.querySelector(".modalContent");
        const scrollTop = modalContent.scrollTop;

        descriptionInput.style.height = "100px";
        descriptionInput.style.height =
            Math.max(100, descriptionInput.scrollHeight) + "px";

        modalContent.scrollTop = scrollTop;
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            resizeDescription();
        });
    });

    descriptionInput.addEventListener("input", function () {
        const modalContent = document.querySelector(".modalContent");
        const textarea = this;
        const scrollTop = modalContent.scrollTop;

        selectedTask.description = textarea.value;
        saveData();
        resizeDescription();

        requestAnimationFrame(() => {
            const style = window.getComputedStyle(textarea);
            const mirror = document.createElement("div");

            [
                "boxSizing", "width", "fontFamily", "fontSize",
                "fontWeight", "fontStyle", "letterSpacing",
                "textTransform", "textIndent", "lineHeight",
                "paddingTop", "paddingRight", "paddingBottom",
                "paddingLeft", "borderTopWidth", "borderRightWidth",
                "borderBottomWidth", "borderLeftWidth"
            ].forEach((prop) => {
                mirror.style[prop] = style[prop];
            });

            Object.assign(mirror.style, {
                position: "absolute",
                visibility: "hidden",
                height: "auto",
                minHeight: "0",
                maxHeight: "none",
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word"
            });

            mirror.textContent =
                textarea.value.substring(0, textarea.selectionStart);

            const marker = document.createElement("span");
            marker.textContent = "\u200b";
            mirror.appendChild(marker);
            document.body.appendChild(mirror);

            const caretY =
                textarea.getBoundingClientRect().top +
                marker.getBoundingClientRect().top -
                mirror.getBoundingClientRect().top;

            mirror.remove();

            const modalRect = modalContent.getBoundingClientRect();
            const margin = 24;

            if (caretY > modalRect.bottom - margin) {
                modalContent.scrollTop +=
                    caretY - modalRect.bottom + margin;
            } else if (caretY < modalRect.top + margin) {
                modalContent.scrollTop -=
                    modalRect.top + margin - caretY;
            } else {
                modalContent.scrollTop = scrollTop;
            }
        });
    });

    const nameInput = document.getElementById("taskNameInput");

    let editingTaskName = selectedTask.name;

    nameInput.addEventListener("blur", function () {
        if (this.value.trim() === "") {
            this.value = editingTaskName;
            return;
        }

        selectedTask.name = this.value.trim();

        saveData();
    });

    nameInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            this.blur();
            return;
        }

        if (event.key === "Escape") {
            this.value = editingTaskName;
            this.blur();
        }
    });

    descriptionInput.addEventListener("blur", function () {
        selectedTask.description = this.value;

        saveData();
    });
}

function createChecklistView(task) {
    let checklistHtml = "";

    checklistHtml += `
    <div id="sortableChecklist">
    `;

    for (let item of task.checklist) {
        const mark = item.done ? "☑" : "□";

        if (item.id === editingChecklistId) {
            checklistHtml += `
            <div
            class="checkItem"
            data-id="${item.id}">

                <span
                class="checkMark"
                data-id="${item.id}">
                    ${mark}
                </span>

                <textarea
                    class="editChecklistInput"
                    data-id="${item.id}"
                    rows="1"
                >${escapeHtml(item.text)}</textarea>

                <button
                class="deleteChecklistButton"
                data-id="${item.id}">
                    ×
                </button>

            </div>
            `;
        } else {
            checklistHtml += `
            <div
            class="checkItem"
            data-id="${item.id}">

                <span
                class="checkMark"
                data-id="${item.id}">
                    ${mark}
                </span>

                <span
                class="checkText"
                data-id="${item.id}">
                    ${escapeHtml(item.text)}
                </span>

                <button
                class="deleteChecklistButton"
                data-id="${item.id}">
                    ×
                </button>

           </div>
            `;
        }
    }

    checklistHtml += `
    </div>
    `;

    if (showChecklistInput) {
        checklistHtml += `

    <div class="checkItem addChecklistItem">

        <input
            id="newChecklistText">

        <button
            id="cancelChecklistButton"
            type="button">
            ×
        </button>

    </div>

    `;
    }

    if (!showChecklistInput) {
        checklistHtml += `

        <button id="addChecklistButton">
            ＋
        </button>

    `;
    }

    return checklistHtml;
}

//イベント

function bindTaskEvents() {
    const taskElements = document.querySelectorAll(".task");

    taskElements.forEach((element) => {
        element.addEventListener("click", function () {
            selectedTaskId = Number(this.dataset.id);

            renderTree();
        });
    });
}

function bindTaskCheckEvents() {

    const checkMarks =
        document.querySelectorAll(".taskCheckMark");

    checkMarks.forEach(mark => {

        mark.addEventListener("click", function (event) {

            event.stopPropagation();

            const checkItem =
                this.closest(".taskCheckItem");

            const taskId =
                Number(checkItem.dataset.taskId);

            const checkId =
                Number(checkItem.dataset.checkId);

            const task =
                findTask(tasks, taskId);

            if (!task) {
                return;
            }

            const item =
                task.checklist.find(
                    c => c.id === checkId
                );

            if (!item) {
                return;
            }

            item.done = true;

            saveData();
            renderTree();

        });

    });

}

function bindCheckMarkEvents(selectedTask) {
    // チェックON/OFF
    const checkMarks = document.querySelectorAll(".checkMark");
    checkMarks.forEach((element) => {
        element.addEventListener("click", function (event) {
            event.stopPropagation();
            const id = Number(this.dataset.id);
            const item = selectedTask.checklist.find((c) => c.id === id);
            if (item) {
                item.done = !item.done;
            }
            saveData();
            renderTree();
        });
    });
}

function bindChecklistDragEvents(selectedTask) {
    const list = document.getElementById("sortableChecklist");

    if (!list) {
        return;
    }

    if (checklistSortable) {
        checklistSortable.destroy();
    }

    checklistSortable = new Sortable(list, {
        animation: 120,

        filter: ".editChecklistInput, #newChecklistText",
        preventOnFilter: false,

        onStart: function () {
            list.classList.add("is-dragging");
        },


        onEnd: function (evt) {
            list.classList.remove("is-dragging");

            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;

            const movedItem = selectedTask.checklist.splice(oldIndex, 1)[0];

            selectedTask.checklist.splice(newIndex, 0, movedItem);
            editingChecklistId = null;

            saveData();

            requestAnimationFrame(() => {
                renderTree();
            });
        },
    });
}

function bindCheckTextEvents(selectedTask) {
    const checkTexts = document.querySelectorAll(".checkText");

    checkTexts.forEach((element) => {
        element.addEventListener("click", function (event) {
            event.stopPropagation();

            const id = Number(this.dataset.id);

            // クリックした文字の位置を取得
            const range = document.caretRangeFromPoint(
                event.clientX,
                event.clientY
            );

            if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                const text = range.startContainer.textContent;

                const leadingSpaces = text.match(/^\s*/)[0].length;

                editingCursorOffset =
                    Math.max(0, range.startOffset - leadingSpaces);
            } else {
                editingCursorOffset = 0;
            }

            if (editingChecklistId !== null && editingChecklistId !== id) {
                const input = document.querySelector(".editChecklistInput");

                if (input) {
                    saveChecklistEdit(input, selectedTask, false);
                }
            }

            editingChecklistId = id;

            renderTree();
        });
    });
}

function bindChecklistAddEvents(selectedTask) {
    // ＋チェックを追加
    const addChecklistButton = document.getElementById("addChecklistButton");

    if (addChecklistButton) {
        addChecklistButton.addEventListener("click", function (event) {
            event.stopPropagation();

            showChecklistInput = true;

            renderTree();
        });
    }

    // 入力欄
    const input = document.getElementById("newChecklistText");

    if (!input) {
        return;
    }

    let saved = false;

    function saveNewChecklist() {
        if (saved) {
            return;
        }

        const text = input.value.trim();

        if (text === "") {
            showChecklistInput = false;

            renderTree();

            return;
        }

        saved = true;

        selectedTask.checklist.push({
            id: nextChecklistId++,
            text: text,
            done: false
        });

        showChecklistInput = false;

        saveData();
        renderTree();
    }

    // Enterで保存
    input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();

            saveNewChecklist();
        }
    });

    // 入力欄から外れたら保存
    input.addEventListener("focusout", function () {
        saveNewChecklist();
    });

    // ×でキャンセル
    const cancelButton = document.getElementById("cancelChecklistButton");

    if (cancelButton) {
        cancelButton.addEventListener("click", function (event) {
            event.stopPropagation();

            showChecklistInput = false;

            renderTree();
        });
    }
}

function bindChecklistDeleteEvents(selectedTask) {
    // チェック削除
    const deleteButtons = document.querySelectorAll(".deleteChecklistButton");
    deleteButtons.forEach((button) => {
        button.addEventListener("click", function (event) {
            event.stopPropagation();
            const id = Number(this.dataset.id);
            confirmDeletion(() => {
                selectedTask.checklist = selectedTask.checklist.filter((item) => item.id !== id);
                saveData();
                renderTree();
            });
        });
    });
}

function bindChecklistEditEvents(selectedTask) {
    const editInputs = document.querySelectorAll(".editChecklistInput");

    editInputs.forEach((input) => {

        input.focus();

        if (editingCursorOffset !== null) {
            const offset = Math.min(
                editingCursorOffset,
                input.value.length
            );

            input.setSelectionRange(offset, offset);

            editingCursorOffset = null;
        }

        function resizeChecklistInput() {
            input.style.height = "auto";

            requestAnimationFrame(() => {
                input.style.height = input.scrollHeight + "px";
            });
        }

        resizeChecklistInput();

        input.addEventListener("input", function () {
            resizeChecklistInput();
        });

        input.addEventListener("blur", function () {
            if (editingChecklistId !== Number(this.dataset.id)) {
                return;
            }

            saveChecklistEdit(this, selectedTask, false);

            const checkItem = this.closest(".checkItem");

            if (checkItem) {
                const text = document.createElement("span");

                text.className = "checkText";
                text.dataset.id = this.dataset.id;
                text.textContent = this.value.trim();

                text.addEventListener("click", function (event) {
                    event.stopPropagation();

                    const id = Number(this.dataset.id);

                    const range = document.caretRangeFromPoint(
                        event.clientX,
                        event.clientY
                    );

                    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                        const textContent = range.startContainer.textContent;

                        const leadingSpaces =
                            textContent.match(/^\s*/)[0].length;

                        editingCursorOffset =
                            Math.max(0, range.startOffset - leadingSpaces);
                    } else {
                        editingCursorOffset = 0;
                    }

                    if (editingChecklistId !== null && editingChecklistId !== id) {
                        const input = document.querySelector(".editChecklistInput");

                        if (input) {
                            saveChecklistEdit(input, selectedTask, false);
                        }
                    }

                    editingChecklistId = id;

                    renderTree();
                });

                this.replaceWith(text);
            }
        });

        input.addEventListener("keydown", function (event) {

            if (event.key === "Tab" && !event.shiftKey) {
                event.preventDefault();

                const currentId = Number(this.dataset.id);

                const currentIndex = selectedTask.checklist.findIndex(
                    item => item.id === currentId
                );

                if (
                    currentIndex !== -1 &&
                    currentIndex < selectedTask.checklist.length - 1
                ) {
                    saveChecklistEdit(this, selectedTask, false);

                    const nextItem =
                        selectedTask.checklist[currentIndex + 1];

                    editingChecklistId = nextItem.id;

                    editingCursorOffset = nextItem.text.length;

                    renderTree();
                } else {
                    saveChecklistEdit(this, selectedTask);
                }

                return;
            }

            // Alt + Enter → 改行
            if (event.key === "Enter" && event.altKey) {
                event.preventDefault();

                const start = this.selectionStart;
                const end = this.selectionEnd;

                this.setRangeText("\n", start, end, "end");

                resizeChecklistInput();

                return;
            }

            // Enter → 保存
            if (event.key === "Enter") {
                event.preventDefault();

                saveChecklistEdit(this, selectedTask);

                return;
            }

            // Escape → キャンセル
            if (event.key === "Escape") {
                event.preventDefault();

                cancelEditing = true;
                editingChecklistId = null;

                renderTree();

                return;
            }
        });
    });
}

function bindChecklistEvents(selectedTask) {
    bindCheckMarkEvents(selectedTask);

    bindCheckTextEvents(selectedTask);

    bindChecklistAddEvents(selectedTask);

    bindChecklistDeleteEvents(selectedTask);

    bindChecklistEditEvents(selectedTask);

    bindChecklistDragEvents(selectedTask);
}

function initializeModal() {
    const closeButton = document.getElementById("closeModalButton");

    closeButton.addEventListener("click", function () {

        const selectedTask =
            findTask(tasks, selectedTaskId);

        if (selectedTask && editingChecklistId !== null) {

            const input =
                document.querySelector(".editChecklistInput");

            if (input) {
                saveChecklistEdit(
                    input,
                    selectedTask
                );
            }
        }

        saveData();

        closeTaskModal();

        renderTree();

    });

    const deleteButton = document.getElementById("deleteTaskButton");

    deleteButton.addEventListener("click", function (event) {
        event.stopPropagation();

        confirmDeletion(deleteSelectedTask);
    });

    const modal = document.getElementById("taskModal");

    let modalMouseDownTarget = null;

    modal.addEventListener("mousedown", function (event) {
        modalMouseDownTarget = event.target;
    });

    modal.addEventListener("click", function (event) {
        // モーダル内からドラッグして外で離した場合は閉じない
        if (
            modalMouseDownTarget &&
            modalMouseDownTarget.closest(".modalContent") &&
            !event.target.closest(".modalContent")
        ) {
            modalMouseDownTarget = null;
            return;
        }

        closeTaskModal();
        renderTree();

        modalMouseDownTarget = null;
    });

    const modalContent = document.querySelector(".modalContent");

    modalContent.addEventListener("click", function (event) {
        event.stopPropagation();
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !document.getElementById("deleteConfirmation").open && !event.defaultPrevented) {
            closeTaskModal();

            renderTree();
        }
    });
}

function openTaskModal() {
    document.getElementById("taskModal").classList.remove("hidden");

    localStorage.setItem("modalOpen", "true");

    localStorage.setItem("selectedTaskId", selectedTaskId);
}

function closeTaskModal() {
    const modal = document.getElementById("taskModal");

    modal.classList.add("hidden");

    selectedTaskId = null;

    localStorage.removeItem("modalOpen");
    localStorage.removeItem("selectedTaskId");
}

function deleteSelectedTask() {
    if (selectedTaskId === null) {
        return;
    }

    tasks.children = tasks.children.filter((task) => task.id !== selectedTaskId);

    selectedTaskId = null;

    saveData();
    renderTree();
}

//画面更新

function renderTree() {

    renderColumns();

    bindTaskEvents();

    bindTaskCheckEvents();

    bindTaskDragEvents();

    const selectedTask = findTask(tasks, selectedTaskId);

    if (selectedTask) {
        renderTaskDetail(selectedTask);

        document.getElementById("checklistView").innerHTML = createChecklistView(selectedTask);

        bindChecklistEvents(selectedTask);

        openTaskModal();

        if (showChecklistInput) {
            const input = document.getElementById("newChecklistText");

            if (input) {
                input.focus();
            }
        }
    } else {
        document.getElementById("taskNameView").textContent = "タスクを選択してください";

        document.getElementById("taskDescriptionView").innerHTML = "";

        document.getElementById("checklistView").innerHTML = "";

        closeTaskModal();
    }
}

function normalizeColumns(data) {
    if (!Array.isArray(data.columns) || !data.columns.length) {
        data.columns = [{ id: "column-1", name: "タスクボード" }];
    }
    const ids = new Set(data.columns.map(column => column.id));
    for (const task of data.children) {
        if (!ids.has(task.columnId)) task.columnId = data.columns[0].id;
    }
    if (!ids.has(activeColumnId)) activeColumnId = data.columns[0].id;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
}

function renderColumns() {
    boardSortables.forEach(sortable => sortable.destroy());
    boardSortables = [];
    const tree = document.getElementById("tree");
    tree.innerHTML = tasks.columns.map(column =>
        '<section class="boardColumn" data-column-id="' + escapeHtml(column.id) + '">' +
        '<header class="columnHeader"><span class="columnDragHandle" title="列を移動" aria-label="列を移動">⠿</span>' +
        '<input class="columnName" aria-label="列名" value="' + escapeHtml(column.name) + '">' +
        '<button class="deleteColumnButton" title="列と中のタスクを削除" aria-label="列と中のタスクを削除">×</button></header>' +
        '<div class="columnTasks" data-column-id="' + escapeHtml(column.id) + '">' + createTaskList(column.id) + '</div></section>'
    ).join("");
    const select = document.getElementById("targetColumn");
    select.innerHTML = tasks.columns.map(column => '<option value="' + escapeHtml(column.id) + '">' + escapeHtml(column.name) + '</option>').join("");
    select.value = activeColumnId;
    tree.querySelectorAll(".boardColumn").forEach(section => {
        const column = tasks.columns.find(column => column.id === section.dataset.columnId);
        const input = section.querySelector(".columnName");
        input.addEventListener("change", () => {
            const name = input.value.trim();
            if (!name) { input.value = column.name; return; }
            column.name = name;
            saveData();
            renderTree();
        });
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") input.blur();
            if (event.key === "Escape") { input.value = column.name; input.blur(); }
        });
        section.querySelector(".deleteColumnButton").addEventListener("click", () => {
            confirmDeletion(() => {
                tasks.children = tasks.children.filter(task => task.columnId !== column.id);
                tasks.columns = tasks.columns.filter(item => item.id !== column.id);
                normalizeColumns(tasks);
                saveData();
                renderTree();
            });
        });
    });
}

function bindTaskDragEvents() {
    const tree = document.getElementById("tree");
    boardSortables.push(new Sortable(tree, {
        animation: 120, draggable: ".boardColumn", handle: ".columnDragHandle",
        onEnd() {
            const columns = new Map(tasks.columns.map(column => [column.id, column]));
            tasks.columns = [...tree.querySelectorAll(":scope > .boardColumn")].map(section => columns.get(section.dataset.columnId));
            saveData();
        }
    }));
    tree.querySelectorAll(".columnTasks").forEach(list => {
        boardSortables.push(new Sortable(list, {
            group: "board-tasks", animation: 120, draggable: ".task",
            onEnd() {
                const byId = new Map(tasks.children.map(task => [String(task.id), task]));
                const ordered = [];
                tree.querySelectorAll(".columnTasks").forEach(container => {
                    container.querySelectorAll(":scope > .task").forEach(element => {
                        const task = byId.get(element.dataset.id);
                        task.columnId = container.dataset.columnId;
                        ordered.push(task);
                    });
                });
                tasks.children = ordered;
                saveData();
            }
        }));
    });
}

document.getElementById("targetColumn").addEventListener("change", event => {
    activeColumnId = event.target.value;
});
document.getElementById("addColumnButton").addEventListener("click", () => {
    const column = {id: "column-" + crypto.randomUUID(), name: "新しい列"};
    tasks.columns.push(column);
    activeColumnId = column.id;
    saveData();
    renderTree();
    const last = document.querySelector(".boardColumn:last-child");
    last.scrollIntoView({block: "nearest", inline: "end", behavior: "smooth"});
    last.querySelector(".columnName").focus({preventScroll: true});
    last.querySelector(".columnName").select();
});

document.getElementById("addButton").addEventListener("click", function () {
    const name = document.getElementById("taskName").value.trim();

    if (name === "") {
        return;
    }

    tasks.children.unshift({
        columnId: activeColumnId,
        id: nextId++,
        name: name,
        description: "",
        checklist: [],
        children: [],
    });

    saveData();
    renderTree();

    document.getElementById("taskName").value = "";
});

document.getElementById("addButtonBottom").addEventListener("click", function () {
    const name = document.getElementById("taskNameBottom").value.trim();

    if (name === "") {
        return;
    }

    tasks.children.push({
        columnId: activeColumnId,
        id: nextId++,
        name: name,
        description: "",
        checklist: [],
        children: [],
    });

    saveData();
    renderTree();

    document.getElementById("taskNameBottom").value = "";
});

document.getElementById("taskName").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        document.getElementById("addButton").click();
    }
});

document.getElementById("taskNameBottom").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        document.getElementById("addButtonBottom").click();
    }
});

const savedData = localStorage.getItem("creativeTasks");

if (savedData) {
    tasks = JSON.parse(savedData);
}

function recalculateIds() {
    nextId = Math.max(0, ...tasks.children.map(task => Number(task.id) || 0)) + 1;
    nextChecklistId = Math.max(0, ...tasks.children.flatMap(task =>
        task.checklist.map(item => Number(item.id) || 0))) + 1;
}
normalizeColumns(tasks);
recalculateIds();
localStorage.setItem("creativeTasks", JSON.stringify(tasks));
savedSnapshot = JSON.stringify(tasks);

const savedModalOpen = localStorage.getItem("modalOpen");

const savedSelectedTaskId = localStorage.getItem("selectedTaskId");

if (savedModalOpen === "true" && savedSelectedTaskId !== null) {
    selectedTaskId = Number(savedSelectedTaskId);
}

document.getElementById("backupButton").addEventListener("click", function () {
    const data = localStorage.getItem("creativeTasks");

    if (!data) {
        return;
    }

    const blob = new Blob([data], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "creativeTasks.json";

    a.click();

    URL.revokeObjectURL(url);
});

initializeModal();
renderTree();

// バックアップから復元
document.getElementById("restoreButton").addEventListener("click", function () {
    document.getElementById("restoreFile").click();
});

document.getElementById("restoreFile").addEventListener("change", function (event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.onload = function () {
        try {
            const restoredTasks = JSON.parse(reader.result);

            if (!restoredTasks.children || !Array.isArray(restoredTasks.children)) {
                alert("正しいバックアップファイルではありません。");
                return;
            }

            tasks = restoredTasks;
            normalizeColumns(tasks);
            recalculateIds();

            saveData();
            renderTree();

        } catch (error) {
            alert("バックアップファイルを読み込めませんでした。");
        }
    };

    reader.readAsText(file);
});