let tasks = {
    children: []
};

let nextId = 1;
let selectedTaskId = null;
let showChecklistInput = false;
let editingChecklistId = null;
let editingOldText = "";
let cancelEditing = false;
let checklistSortable = null;

function saveData() {
    localStorage.setItem(
        "creativeTasks",
        JSON.stringify(tasks)
    );
}

// データ処理

function getProgress(task) {
    if (!task.checklist || task.checklist.length === 0) {
        return 0;
    }
    const doneCount = task.checklist.filter(item => item.done).length;
    return Math.round(doneCount / task.checklist.length * 100);
}

function findTask(task, id) {

    return task.children.find(
        child => child.id == id
    ) || null;

}

function saveChecklistEdit(input, selectedTask) {

    const id = Number(input.dataset.id);

    const item =
        selectedTask.checklist.find(
            c => c.id === id
        );

    if (!item) {
        return;
    }

    item.text =
        input.value.trim();

    saveData();

    editingChecklistId = null;

    renderTree();
}

// HTML生成

function getNextChecklist(task, count = 2) {
    return task.checklist
        .filter(item => !item.done)
        .slice(0, count);
}

function createTaskList() {

    let html = "";

    for (const task of tasks.children) {

        const progress = getProgress(task);

        const selectedClass =
            task.id === selectedTaskId
                ? "selected"
                : "";

        const nextItems =
            getNextChecklist(task);

        const item =
            nextItems[0];

        const nextHtml =
            item
                ? `
            <span
                class="taskCheckItem"
                data-task-id="${task.id}"
                data-check-id="${item.id}">
                □ ${item.text}
            </span>
        `
                : "";

        html += `
        <div class="task ${selectedClass}" data-id="${task.id}">

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

    const doneCount =
        selectedTask.checklist.filter(item => item.done).length;

    document.getElementById("checklistProgress").textContent =
        `${progress}%  ${doneCount}/${totalCount}`;

    document.getElementById("taskNameView").innerHTML = `
        <input
            id="taskNameInput"
            value="${selectedTask.name}"
        >
        `;

    document.getElementById("taskDescriptionView").innerHTML = `
    <textarea id="taskDescriptionInput">${selectedTask.description}</textarea>
`;

    const descriptionInput =
        document.getElementById("taskDescriptionInput");

    function resizeDescription() {

    const modalContent =
        document.querySelector(".modalContent");

    const scrollTop =
        modalContent.scrollTop;

    descriptionInput.style.height = "100px";

    requestAnimationFrame(() => {

        if (descriptionInput.scrollHeight > 100) {

            descriptionInput.style.height =
                descriptionInput.scrollHeight + "px";

        }

        modalContent.scrollTop = scrollTop;

    });
}

    resizeDescription();

    descriptionInput.addEventListener("input", function () {

        resizeDescription();

        selectedTask.description = this.value;

        saveData();
    });

    const nameInput =
        document.getElementById("taskNameInput");

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

                <input
                class="editChecklistInput"
                data-id="${item.id}"
                value="${item.text}">

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

    const taskElements =
        document.querySelectorAll(".task");

    taskElements.forEach(element => {

        element.addEventListener("click", function () {

            selectedTaskId =
                Number(this.dataset.id);

            renderTree();

        });

    });

}

function bindTaskCheckEvents() {

    const checkItems =
        document.querySelectorAll(".taskCheckItem");

    checkItems.forEach(element => {

        element.addEventListener("click", function (event) {

            event.stopPropagation();

            const taskId =
                Number(this.dataset.taskId);

            const checkId =
                Number(this.dataset.checkId);

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
    checkMarks.forEach(element => {
        element.addEventListener("click", function (event) {
            event.stopPropagation();
            const id = Number(this.dataset.id);
            const item = selectedTask.checklist.find(c => c.id === id);
            if (item) {
                item.done = !item.done;
            }
            saveData();
            renderTree();
        });
    });

}

function bindChecklistDragEvents(selectedTask) {

    const list =
        document.getElementById(
            "sortableChecklist"
        );


    if (!list) {
        return;
    }


    if (checklistSortable) {
        checklistSortable.destroy();
    }


    checklistSortable = new Sortable(list, {

        animation: 150,

        onEnd: function (evt) {

            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;


            const movedItem =
                selectedTask.checklist.splice(
                    oldIndex,
                    1
                )[0];


            selectedTask.checklist.splice(
                newIndex,
                0,
                movedItem
            );


            saveData();

            renderTree();

        }

    });

}

function bindCheckTextEvents(selectedTask) {

    const checkTexts =
        document.querySelectorAll(".checkText");


    checkTexts.forEach(element => {

        element.addEventListener("click", function (event) {

            event.stopPropagation();

            const id =
                Number(this.dataset.id);

            editingChecklistId = id;

            renderTree();

        });

    });

}

function bindChecklistAddEvents(selectedTask) {

    // ＋チェックを追加
    const addChecklistButton =
        document.getElementById("addChecklistButton");

    if (addChecklistButton) {

        addChecklistButton.addEventListener("click", function (event) {

            event.stopPropagation();

            showChecklistInput = true;

            renderTree();

            document.getElementById("newChecklistText").focus();

        });

    }

    // 入力欄
    const input =
        document.getElementById("newChecklistText");

    if (!input) {
        return;
    }

    let saved = false;

    function saveNewChecklist() {

        // すでに保存済みなら何もしない
        if (saved) {
            return;
        }

        const text =
            input.value.trim();

        if (text === "") {
            return;
        }

        saved = true;

        selectedTask.checklist.push({
            id: nextId++,
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
    input.addEventListener("blur", function () {

        saveNewChecklist();

    });

    // ×でキャンセル
    const cancelButton =
        document.getElementById("cancelChecklistButton");

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
    deleteButtons.forEach(button => {
        button.addEventListener("click", function (event) {
            event.stopPropagation();
            const id = Number(this.dataset.id);
            selectedTask.checklist =
                selectedTask.checklist.filter(item => item.id !== id);
            saveData();
            renderTree();
        });
    });
}

function bindChecklistEditEvents(selectedTask) {
    // 編集
    const editInputs = document.querySelectorAll(".editChecklistInput");
    editInputs.forEach(input => {
        // 入力欄に自動フォーカス
        input.focus();
        // カーソルを末尾へ
        input.setSelectionRange(
            input.value.length,
            input.value.length
        );
        // キーボード操作
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                saveChecklistEdit(this, selectedTask);
                return;
            }
            if (event.key === "Escape") {
                cancelEditing = true;
                editingChecklistId = null;
                renderTree();
                return;
            }
        });
        // フォーカスが外れたら保存
        input.addEventListener("blur", function () {
            if (cancelEditing) {
                cancelEditing = false;
                return;
            }
            saveChecklistEdit(this, selectedTask);
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

    const closeButton =
        document.getElementById("closeModalButton");

    closeButton.addEventListener("click", function () {

        closeTaskModal();

        renderTree();

    });

    const deleteButton =
        document.getElementById("deleteTaskButton");

    deleteButton.addEventListener("click", function (event) {

        event.stopPropagation();

        deleteSelectedTask();

    });

    const modal =
        document.getElementById("taskModal");

    modal.addEventListener("click", function () {

        closeTaskModal();

        renderTree();

    });

    const modalContent =
        document.querySelector(".modalContent");

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

    document.getElementById("taskModal")
        .classList.remove("hidden");

    localStorage.setItem("modalOpen", "true");

    localStorage.setItem(
        "selectedTaskId",
        selectedTaskId
    );
}

function closeTaskModal() {

    const modal =
        document.getElementById("taskModal");

    modal.classList.add("hidden");

    selectedTaskId = null;

    localStorage.removeItem("modalOpen");
    localStorage.removeItem("selectedTaskId");
}

function deleteSelectedTask() {

    if (selectedTaskId === null) {
        return;
    }

    tasks.children =
        tasks.children.filter(
            task => task.id !== selectedTaskId
        );

    selectedTaskId = null;

    saveData();
    renderTree();
}

//画面更新

function renderTree() {

    document.getElementById("tree").innerHTML =
        createTaskList(tasks);

    bindTaskEvents();

    bindTaskCheckEvents();

    bindTaskDragEvents();

    const selectedTask =
        findTask(tasks, selectedTaskId);

    if (selectedTask) {

        renderTaskDetail(selectedTask);

        document.getElementById("checklistView").innerHTML =
            createChecklistView(selectedTask);

        bindChecklistEvents(selectedTask);

        openTaskModal();

    }
    else {

        document.getElementById("taskNameView").textContent =
            "タスクを選択してください";

        document.getElementById("taskDescriptionView").innerHTML = "";

        document.getElementById("checklistView").innerHTML = "";

        closeTaskModal();

    }

}

function bindTaskDragEvents() {

    const tree =
        document.getElementById("tree");

    new Sortable(tree, {

        animation: 150,

        onEnd: function () {

            const elements =
                tree.querySelectorAll(":scope > .task");

            const newChildren = [];

            elements.forEach(element => {

                const id =
                    Number(element.dataset.id);

                const task = findTask(tasks, id);

                if (task) {
                    newChildren.push(task);
                }

            });

            // 並び替えた順番をtasks.childrenに反映
            tasks.children = newChildren;

            // 保存
            saveData();

        }

    });

}

document.getElementById("addButton").addEventListener("click", function () {
    const name = document.getElementById("taskName").value.trim();

    if (name === "") {
        return;
    }

    tasks.children.push({
        id: nextId++,
        name: name,
        description: "",
        checklist: [],
        children: []
    });

    saveData();
    renderTree();

    document.getElementById("taskName").value = "";
});

document.getElementById("taskName").addEventListener("keydown", function (event) {

    if (event.key === "Enter") {
        document.getElementById("addButton").click();
    }

});

const savedData =
    localStorage.getItem("creativeTasks");

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

const savedModalOpen =
    localStorage.getItem("modalOpen");

const savedSelectedTaskId =
    localStorage.getItem("selectedTaskId");

if (
    savedModalOpen === "true" &&
    savedSelectedTaskId !== null
) {
    selectedTaskId =
        Number(savedSelectedTaskId);
}

initializeModal();
renderTree();


