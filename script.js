let tasks = {
    children: [],
};
let nextId = 1;
let nextChecklistId = 1;
let selectedTaskId = null;
let showChecklistInput = false;
let editingChecklistId = null;
let editingOldText = "";
let cancelEditing = false;
let checklistSortable = null;
let editingCursorOffset = null;

function saveData() {
    localStorage.setItem("creativeTasks", JSON.stringify(tasks));
}

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

function createTaskList() {
    let html = "";

    for (const task of tasks.children) {
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
                    ${item.text}
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
                ${task.name}
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
            value="${selectedTask.name}"
        >
        `;

    document.getElementById("taskDescriptionView").innerHTML = `
    <textarea id="taskDescriptionInput">${selectedTask.description}</textarea>
`;

    const descriptionInput = document.getElementById("taskDescriptionInput");

    descriptionInput.addEventListener("keydown", function (event) {
        if (event.key === " ") {
            event.stopPropagation();
        }
    });

    function resizeDescription() {
        const modalContent = document.querySelector(".modalContent");

        const scrollTop = modalContent.scrollTop;

        descriptionInput.style.height = "100px";

        requestAnimationFrame(() => {
            if (descriptionInput.scrollHeight > 100) {
                descriptionInput.style.height = descriptionInput.scrollHeight + "px";
            }

            modalContent.scrollTop = scrollTop;
        });
    }

    resizeDescription();

    descriptionInput.addEventListener("input", function () {
        selectedTask.description = this.value;

        saveData();
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
                >${item.text}</textarea>

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
                    ${item.text}
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
            selectedTask.checklist = selectedTask.checklist.filter((item) => item.id !== id);
            saveData();
            renderTree();
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
            if (editingChecklistId === Number(this.dataset.id)) {
                saveChecklistEdit(this, selectedTask, false);
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

                    editingChecklistId =
                        selectedTask.checklist[currentIndex + 1].id;

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

        deleteSelectedTask();
    });

    const modal = document.getElementById("taskModal");

    modal.addEventListener("click", function () {
        closeTaskModal();

        renderTree();
    });

    const modalContent = document.querySelector(".modalContent");

    modalContent.addEventListener("click", function (event) {
        event.stopPropagation();
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
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

    document.getElementById("tree").innerHTML = createTaskList(tasks);

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

function bindTaskDragEvents() {
    const tree = document.getElementById("tree");

    new Sortable(tree, {
        animation: 120,

        onEnd: function () {
            const elements = tree.querySelectorAll(":scope > .task");

            const newChildren = [];

            elements.forEach((element) => {
                const id = Number(element.dataset.id);

                const task = findTask(tasks, id);

                if (task) {
                    newChildren.push(task);
                }
            });

            // 並び替えた順番をtasks.childrenに反映
            tasks.children = newChildren;

            // 保存
            saveData();
        },
    });
}

document.getElementById("addButton").addEventListener("click", function () {
    const name = document.getElementById("taskName").value.trim();

    if (name === "") {
        return;
    }

    tasks.children.unshift({
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

let maxId = 0;

for (const task of tasks.children) {
    if (task.id > maxId) {
        maxId = task.id;
    }
}

nextId = maxId + 1;

let maxChecklistId = 0;

for (const task of tasks.children) {
    for (const item of task.checklist) {
        if (item.id > maxChecklistId) {
            maxChecklistId = item.id;
        }
    }
}

nextChecklistId = maxChecklistId + 1;

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

            saveData();
            renderTree();

        } catch (error) {
            alert("バックアップファイルを読み込めませんでした。");
        }
    };

    reader.readAsText(file);
});