class TodoApp {
    constructor() {
        this.elements = {
            addTaskBtn: document.getElementById('add-task-btn'),
            taskInput: document.getElementById('task-input'),
            dueDateInput: document.getElementById('due-date'),
            taskDescription: document.getElementById('task-description'),
            taskPriority: document.getElementById('task-priority'),
            taskTags: document.getElementById('task-tags'),
            taskList: document.getElementById('task-list'),
            filterButtons: document.querySelectorAll('.filter-buttons button'),
            clearTasksBtn: document.getElementById('clear-tasks-btn'),
            toggleDarkModeBtn: document.getElementById('toggle-dark-mode'),
            taskCount: document.getElementById('task-count'),
            sortTasks: document.getElementById('sort-tasks'),
            progressBar: document.getElementById('progress-bar'),
            loadingSpinner: document.getElementById('loading-spinner'),
            emptyState: document.getElementById('empty-state'),
            charCounter: document.getElementById('char-counter'),
            editModal: document.getElementById('edit-modal'),
            editTaskForm: document.getElementById('edit-task-form'),
            editTaskText: document.getElementById('edit-task-text'),
            editTaskDescription: document.getElementById('edit-task-description'),
            editTaskDueDate: document.getElementById('edit-task-due-date'),
            editTaskPriority: document.getElementById('edit-task-priority'),
            editTaskTags: document.getElementById('edit-task-tags'),
            cancelEditBtn: document.getElementById('cancel-edit-btn')
        };

        this.currentFilter = 'all';
        this.currentSort = 'due-date';
        this.priorityOrder = { 
            critical: 1, 
            urgent: 2, 
            high: 3, 
            medium: 4, 
            low: 5, 
            lowest: 6 
        };
        this.priorityIcons = {
            critical: '<i class="fas fa-exclamation-triangle"></i>',
            urgent: '<i class="fas fa-exclamation-circle"></i>',
            high: '<i class="fas fa-arrow-circle-up"></i>',
            medium: '<i class="fas fa-minus-circle"></i>',
            low: '<i class="fas fa-arrow-circle-down"></i>',
            lowest: '<i class="fas fa-circle"></i>'
        };
        this.currentEditTaskId = null;
        this.shortcuts = {
            'n': () => this.elements.taskInput.focus(), // New task
            'f': () => this.elements.filterButtons[0].click(), // All tasks
            'p': () => this.elements.filterButtons[1].click(), // Pending tasks
            'c': () => this.elements.filterButtons[2].click(), // Completed tasks
            'd': () => this.toggleDarkMode(), // Toggle dark mode
            'h': () => this.toggleShortcutsHelp(), // Show help
        };
        this.categories = ['Work', 'Personal', 'Shopping', 'Health', 'Important'];
        this.init();
    }

    init() {
        if (!this.elements.taskList || !this.elements.addTaskBtn) {
            console.error('Required DOM elements not found');
            this.showToast('Application initialization failed');
            return;
        }
        this.setupEventListeners();
        this.loadTasks();
        this.loadDarkMode();
        this.updateTaskCount();
        this.updateCharCounter();
    }

    setupEventListeners() {
        this.elements.addTaskBtn.addEventListener('click', () => this.addTask());
        this.elements.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        this.elements.taskDescription.addEventListener('input', () => this.updateCharCounter());
        this.elements.clearTasksBtn.addEventListener('click', () => this.clearAllTasks());
        this.elements.toggleDarkModeBtn.addEventListener('click', () => this.toggleDarkMode());

        this.elements.filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.currentFilter = button.dataset.filter;
                this.updateFilterButtons();
                this.filterTasks(this.currentFilter);
            });
        });

        this.elements.sortTasks.addEventListener('change', () => {
            this.currentSort = this.elements.sortTasks.value;
            this.loadTasks();
        });

        this.elements.taskList.addEventListener('dragstart', (e) => {
            if (e.target.tagName === 'LI') {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.id);
            }
        });

        this.elements.taskList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(e.clientY);
            const draggable = document.querySelector('.dragging');
            if (afterElement == null) {
                this.elements.taskList.appendChild(draggable);
            } else {
                this.elements.taskList.insertBefore(draggable, afterElement);
            }
        });

        this.elements.taskList.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
            this.saveTaskOrder();
        });

        this.elements.editTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEditedTask();
        });

        this.elements.cancelEditBtn.addEventListener('click', () => {
            this.closeEditModal();
        });

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key in this.shortcuts) {
                e.preventDefault();
                this.shortcuts[e.key]();
            }
        });
    }

    getDragAfterElement(y) {
        const draggableElements = [...this.elements.taskList.querySelectorAll('li:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    saveTaskOrder() {
        const tasks = this.getTasks();
        const newOrder = [...this.elements.taskList.querySelectorAll('li')].map(li => li.dataset.id);
        const reorderedTasks = newOrder.map(id => tasks.find(task => task.id === id)).filter(task => task);
        this.saveTasks(reorderedTasks);
    }

    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    updateCharCounter() {
        const maxLength = this.elements.taskDescription.maxLength;
        const currentLength = this.elements.taskDescription.value.length;
        this.elements.charCounter.textContent = `${maxLength - currentLength}/${maxLength}`;
    }

    addTask() {
        const taskText = this.sanitizeInput(this.elements.taskInput.value.trim());
        const dueDate = this.elements.dueDateInput.value;
        const description = this.sanitizeInput(this.elements.taskDescription.value.trim());
        const priority = this.elements.taskPriority.value;
        const tags = this.sanitizeInput(this.elements.taskTags.value.trim()).split(',').map(tag => tag.trim()).filter(tag => tag);

        if (taskText === '') {
            this.showToast('Task cannot be empty!');
            return;
        }

        if (dueDate && new Date(dueDate) < new Date().setHours(0, 0, 0, 0)) {
            this.showToast('Due date cannot be in the past!');
            return;
        }

        const task = {
            id: Date.now().toString(),
            text: taskText,
            dueDate: dueDate,
            description: description,
            priority: priority,
            tags: tags,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.elements.loadingSpinner.classList.remove('hidden');
        setTimeout(() => {
            this.createTaskElement(task);
            this.saveTask(task);
            this.elements.taskInput.value = '';
            this.elements.dueDateInput.value = '';
            this.elements.taskDescription.value = '';
            this.elements.taskPriority.value = 'low';
            this.elements.taskTags.value = '';
            this.updateTaskCount();
            this.updateCharCounter();
            this.elements.taskInput.focus();
            this.showToast('Task added!');
            this.elements.loadingSpinner.classList.add('hidden');
        }, 500);
    }

    createTaskElement(task) {
        const li = document.createElement('li');
        li.dataset.id = task.id;
        li.setAttribute('role', 'listitem');
        li.setAttribute('draggable', 'true');
        if (task.completed) li.classList.add('completed');
        if (task.dueDate) {
            const due = new Date(task.dueDate);
            const today = new Date().setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (due < new Date(today)) li.classList.add('overdue');
            else if (due.toDateString() === new Date(today).toDateString() || due.toDateString() === tomorrow.toDateString()) {
                li.classList.add('due-soon');
            }
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.setAttribute('aria-label', `Mark task ${task.text} as completed`);
        checkbox.addEventListener('change', () => this.toggleTaskCompletion(task.id));

        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;

        const taskMeta = document.createElement('div');
        taskMeta.className = 'task-meta';
        if (task.dueDate || task.tags.length) {
            const metaContent = document.createElement('span');
            metaContent.className = 'meta-content';
            if (task.dueDate) {
                const dateSpan = document.createElement('span');
                dateSpan.className = 'task-date';
                dateSpan.textContent = this.formatDate(task.dueDate);
                metaContent.appendChild(dateSpan);
            }
            if (task.tags && task.tags.length) {
                const tagsDiv = document.createElement('span');
                tagsDiv.className = 'task-tags';
                task.tags.forEach(tag => {
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'tag';
                    tagSpan.textContent = tag;
                    tagsDiv.appendChild(tagSpan);
                });
                metaContent.appendChild(tagsDiv);
            }
            taskMeta.appendChild(metaContent);
        }

        if (task.description) {
            const descriptionSpan = document.createElement('span');
            descriptionSpan.className = 'task-description hidden';
            descriptionSpan.textContent = task.description;
            taskMeta.appendChild(descriptionSpan);
            taskText.classList.add('toggleable');
            taskText.addEventListener('click', () => {
                descriptionSpan.classList.toggle('hidden');
                taskText.classList.toggle('expanded');
            });
        }

        taskContent.appendChild(taskText);
        taskContent.appendChild(taskMeta);

        const prioritySpan = document.createElement('span');
        prioritySpan.className = `priority-indicator priority-${task.priority}`;
        prioritySpan.setAttribute('aria-label', `${task.priority} priority`);
        prioritySpan.setAttribute('title', `${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority`);
        prioritySpan.innerHTML = this.priorityIcons[task.priority];

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'task-actions';
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.className = 'action-btn';
        editBtn.setAttribute('aria-label', `Edit task ${task.text}`);
        editBtn.addEventListener('click', () => this.openEditModal(task.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.className = 'action-btn';
        deleteBtn.setAttribute('aria-label', `Delete task ${task.text}`);
        deleteBtn.addEventListener('click', () => this.deleteTask(task.id));

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(checkbox);
        li.appendChild(prioritySpan);
        li.appendChild(taskContent);
        li.appendChild(actionsDiv);

        this.elements.taskList.appendChild(li);
        li.classList.add('fade-in');
    }

    openEditModal(taskId) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) {
            this.showToast('Task not found!');
            return;
        }

        this.currentEditTaskId = taskId;
        this.elements.editTaskText.value = task.text;
        this.elements.editTaskDescription.value = task.description || '';
        this.elements.editTaskDueDate.value = task.dueDate || '';
        this.elements.editTaskPriority.value = task.priority;
        this.elements.editTaskTags.value = task.tags.join(', ');
        this.elements.editModal.classList.remove('hidden');
        this.elements.editTaskText.focus();
    }

    saveEditedTask() {
        const taskText = this.sanitizeInput(this.elements.editTaskText.value.trim());
        const description = this.sanitizeInput(this.elements.editTaskDescription.value.trim());
        const dueDate = this.elements.editTaskDueDate.value;
        const priority = this.elements.editTaskPriority.value;
        const tags = this.sanitizeInput(this.elements.editTaskTags.value.trim()).split(',').map(tag => tag.trim()).filter(tag => tag);

        if (taskText === '') {
            this.showToast('Task cannot be empty!');
            return;
        }

        if (dueDate && new Date(dueDate) < new Date().setHours(0, 0, 0, 0)) {
            this.showToast('Due date cannot be in the past!');
            return;
        }

        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === this.currentEditTaskId);
        if (task) {
            task.text = taskText;
            task.description = description;
            task.dueDate = dueDate;
            task.priority = priority;
            task.tags = tags;
            try {
                this.saveTasks(tasks);
                this.loadTasks();
                this.closeEditModal();
                this.showToast('Task updated!');
            } catch (e) {
                console.error('Failed to save edited task:', e);
                this.showToast('Error updating task');
            }
        }
    }

    closeEditModal() {
        this.elements.editModal.classList.add('hidden');
        this.currentEditTaskId = null;
    }

    deleteTask(taskId) {
        const li = document.querySelector(`li[data-id="${taskId}"]`);
        if (!li) {
            this.showToast('Task not found!');
            return;
        }

        li.classList.add('fade-out');
        setTimeout(() => {
            const tasks = this.getTasks().filter(task => task.id !== taskId);
            try {
                this.saveTasks(tasks);
                this.updateTaskCount();
                li.remove();
                this.showToast('Task deleted!');
            } catch (e) {
                console.error('Failed to delete task:', e);
                this.showToast('Error deleting task');
            }
        }, 400);
    }

    toggleTaskCompletion(taskId) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) {
            this.showToast('Task not found!');
            return;
        }

        task.completed = !task.completed;
        try {
            this.saveTasks(tasks);
        } catch (e) {
            console.error('Failed to save tasks:', e);
            this.showToast('Error saving task state');
            return;
        }

        const li = document.querySelector(`li[data-id="${taskId}"]`);
        if (li) {
            li.classList.toggle('completed', task.completed);
            const checkbox = li.querySelector('input[type="checkbox"]');
            checkbox.checked = task.completed;
            checkbox.classList.add('bounce');
            setTimeout(() => checkbox.classList.remove('bounce'), 300);
        }

        this.filterTasks(this.currentFilter);
        this.updateTaskCount();

        this.showToast(task.completed ? 'Task completed!' : 'Task marked pending!');
        if (task.completed && tasks.every(t => t.completed) && tasks.length > 0) {
            this.triggerConfetti();
        }
    }

    triggerConfetti() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }

    saveTask(task) {
        const tasks = this.getTasks();
        tasks.push(task);
        try {
            this.saveTasks(tasks);
        } catch (e) {
            console.error('Failed to save task:', e);
            this.showToast('Error saving task');
        }
    }

    saveTasks(tasks) {
        try {
            this.elements.loadingSpinner.classList.remove('hidden');
            localStorage.setItem('tasks', JSON.stringify(tasks));
            this.elements.loadingSpinner.classList.add('hidden');
        } catch (e) {
            console.error('Failed to save tasks:', e);
            this.showToast('Error saving tasks');
            throw e;
        }
    }

    getTasks() {
        try {
            return JSON.parse(localStorage.getItem('tasks')) || [];
        } catch (e) {
            console.error('Failed to load tasks:', e);
            this.showToast('Error loading tasks');
            return [];
        }
    }

    loadTasks() {
        this.elements.loadingSpinner.classList.remove('hidden');
        this.elements.taskList.innerHTML = '';
        const tasks = this.getTasks().sort((a, b) => {
            switch (this.currentSort) {
                case 'due-date':
                    if (a.completed !== b.completed) return a.completed ? 1 : -1;
                    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
                    if (a.dueDate) return -1;
                    if (b.dueDate) return 1;
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'created-date':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'alphabetical':
                    return a.text.localeCompare(b.text);
                case 'priority':
                    if (a.completed !== b.completed) return a.completed ? 1 : -1;
                    return this.priorityOrder[a.priority] - this.priorityOrder[b.priority];
                default:
                    return 0;
            }
        });

        if (tasks.length === 0) {
            this.elements.emptyState.classList.remove('hidden');
        } else {
            this.elements.emptyState.classList.add('hidden');
            tasks.forEach(task => this.createTaskElement(task));
        }
        this.filterTasks(this.currentFilter);
        this.elements.loadingSpinner.classList.add('hidden');
    }

    filterTasks(filter) {
        const tasks = this.elements.taskList.querySelectorAll('li');
        tasks.forEach(task => {
            const isCompleted = task.classList.contains('completed');
            task.style.display = '';
            switch (filter) {
                case 'all':
                    task.style.display = '';
                    break;
                case 'completed':
                    task.style.display = isCompleted ? '' : 'none';
                    break;
                case 'pending':
                    task.style.display = !isCompleted ? '' : 'none';
                    break;
            }
        });
        this.updateFilterButtons();
    }

    updateFilterButtons() {
        this.elements.filterButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.filter === this.currentFilter);
        });
    }

    clearAllTasks() {
        if (confirm('Delete all tasks?')) {
            try {
                localStorage.removeItem('tasks');
                this.elements.taskList.innerHTML = '';
                this.updateTaskCount();
                this.showToast('All tasks cleared!');
                this.elements.emptyState.classList.remove('hidden');
            } catch (e) {
                console.error('Failed to clear tasks:', e);
                this.showToast('Error clearing tasks');
            }
        }
    }

    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        try {
            localStorage.setItem('darkMode', isDark);
            this.elements.toggleDarkModeBtn.innerHTML = `<i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}"></i>`;
            this.showToast(isDark ? 'Dark mode enabled!' : 'Light mode enabled!');
        } catch (e) {
            console.error('Failed to save dark mode preference:', e);
            this.showToast('Error toggling dark mode');
        }
    }

    loadDarkMode() {
        try {
            const darkMode = JSON.parse(localStorage.getItem('darkMode'));
            if (darkMode) {
                document.body.classList.add('dark-mode');
                this.elements.toggleDarkModeBtn.innerHTML = '<i class="fas fa-sun"></i>';
            }
        } catch (e) {
            console.error('Failed to load dark mode preference:', e);
            this.showToast('Error loading dark mode');
        }
    }

    updateTaskCount() {
        const tasks = this.getTasks();
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        this.elements.taskCount.textContent = `${completed}/${total} tasks`;
        this.elements.progressBar.style.width = `${percentage}%`;
        this.elements.progressBar.setAttribute('aria-valuenow', percentage);
        this.elements.progressBar.setAttribute('title', `${percentage}% complete`);
        this.elements.emptyState.classList.toggle('hidden', tasks.length > 0);
    }

    formatDate(dateString) {
        const options = { month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    toggleShortcutsHelp() {
        const helpModal = document.createElement('div');
        helpModal.className = 'modal';
        helpModal.innerHTML = `
            <div class="modal-content">
                <h2>Keyboard Shortcuts</h2>
                <div class="shortcuts-list">
                    <div><kbd>N</kbd> New task</div>
                    <div><kbd>F</kbd> Show all tasks</div>
                    <div><kbd>P</kbd> Show pending tasks</div>
                    <div><kbd>C</kbd> Show completed tasks</div>
                    <div><kbd>D</kbd> Toggle dark mode</div>
                    <div><kbd>H</kbd> Show this help</div>
                </div>
                <div class="modal-actions">
                    <button class="primary-btn">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(helpModal);
        const closeBtn = helpModal.querySelector('button');
        closeBtn.addEventListener('click', () => helpModal.remove());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TodoApp();
});