// DOM Elements
const collectionsView = document.getElementById('collections-view');
const itemsView = document.getElementById('items-view');
const newCollectionInput = document.getElementById('new-collection-name');
const addCollectionBtn = document.getElementById('add-collection-btn');
const collectionsList = document.getElementById('collections-list');
const collectionsEmpty = document.getElementById('collections-empty');
const backBtn = document.getElementById('back-btn');
const headerTitle = document.getElementById('header-title');
const addCurrentPageBtn = document.getElementById('add-current-page-btn');
const dragDropZone = document.getElementById('drag-drop-zone');
const newNoteInput = document.getElementById('new-note-input');
const addNoteBtn = document.getElementById('add-note-btn');
const itemsList = document.getElementById('items-list');
const itemsEmpty = document.getElementById('items-empty');
const stickyControls = document.getElementById('sticky-controls');
const sortBtn = document.getElementById('sort-btn');
let sortReversed = false;

// Clean UI elements
const menuBtn = document.getElementById('menu-btn');
const dropdownMenu = document.getElementById('dropdown-menu');

// Bulk action buttons (now in dropdown menu)
const openAllTabsBtn = document.getElementById('open-all-tabs');
const openAllWindowBtn = document.getElementById('open-all-window');
const openAllIncognitoBtn = document.getElementById('open-all-incognito');
const copyAllLinksBtn = document.getElementById('copy-all-links');

// Export/Import buttons
const exportBackupBtn = document.getElementById('export-backup-btn');
const importBackupBtn = document.getElementById('import-backup-btn');
const fileInput = document.getElementById('file-input');

// Confirmation dialog elements
const confirmationDialog = document.getElementById('confirmation-dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogMessage = document.getElementById('dialog-message');
const dialogCancel = document.getElementById('dialog-cancel');
const dialogConfirm = document.getElementById('dialog-confirm');

// State
let state = {
    collections: {},
    collectionsOrder: [],
    activeCollection: null,
    draggedItem: null,
    draggedCollectionIndex: null
};

// Initialization flag to prevent dialogs during startup
let isInitializing = true;

// Storage functions
const saveData = () => {
    chrome.storage.local.set({
        collections: state.collections,
        collectionsOrder: state.collectionsOrder
    });
};

const loadData = () => {
    return new Promise((resolve) => {
        chrome.storage.local.get(['collections', 'collectionsOrder'], (result) => {
            if (result.collections) {
                state.collections = result.collections;
            }
            if (result.collectionsOrder) {
                state.collectionsOrder = result.collectionsOrder;
            } else {
                // Initialize order from existing collections
                state.collectionsOrder = Object.keys(state.collections);
            }
            resolve();
        });
    });
};

// Utility functions
const escapeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
};

const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
};

const getItemCount = (collectionName) => {
    return (state.collections[collectionName] || []).length;
};

// Generate unique ID for items
const generateItemId = (item) => {
    if (item.type === 'page') {
        return `page_${item.url}`;
    } else if (item.type === 'text') {
        return `text_${item.content.substring(0, 50)}`;
    } else if (item.type === 'image') {
        return `image_${item.src}`;
    } else if (item.type === 'note') {
        return `note_${item.timestamp}`;
    }
    return `item_${item.timestamp}`;
};

// Generate fallback favicon
const generateFavicon = (domain) => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 16, 16);
    gradient.addColorStop(0, '#0d6efd');
    gradient.addColorStop(1, '#0b5ed7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    
    // First letter
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(domain.charAt(0).toUpperCase(), 8, 8);
    
    return canvas.toDataURL();
};

// Use in renderItems when favicon fails
const handleFaviconError = (img, domain) => {
    img.src = generateFavicon(domain);
};

// FIXED: Clear any stuck dialogs on initialization
const clearStuckDialogs = () => {
    const dialogs = document.querySelectorAll('.confirmation-dialog');
    dialogs.forEach(dialog => {
        dialog.classList.add('hidden');
        dialog.style.display = 'none';
    });
    
    if (confirmationDialog) {
        confirmationDialog.classList.add('hidden');
        confirmationDialog.style.display = 'none';
    }
    
    // Reset any pending confirmation state
    if (window.pendingConfirmation) {
        window.pendingConfirmation = null;
    }

    // Close dropdown menu if stuck
    if (dropdownMenu) {
        dropdownMenu.classList.remove('show');
    }
};

// FIXED: Robust confirmation dialog with initialization check
const showConfirmDialog = (title, message) => {
    return new Promise((resolve) => {
        // Skip confirmation during initialization
        if (isInitializing) {
            console.log('Skipping confirmation dialog during initialization');
            resolve(false);
            return;
        }

        // Check if dialog elements exist
        if (!confirmationDialog || !dialogTitle || !dialogMessage || !dialogConfirm || !dialogCancel) {
            console.warn('Dialog elements not found, proceeding without confirmation');
            resolve(true);
            return;
        }

        try {
            dialogTitle.textContent = title;
            dialogMessage.textContent = message;
            confirmationDialog.classList.remove('hidden');
            confirmationDialog.style.display = 'flex';

            const handleConfirm = () => {
                confirmationDialog.classList.add('hidden');
                confirmationDialog.style.display = 'none';
                dialogConfirm.removeEventListener('click', handleConfirm);
                dialogCancel.removeEventListener('click', handleCancel);
                resolve(true);
            };

            const handleCancel = () => {
                confirmationDialog.classList.add('hidden');
                confirmationDialog.style.display = 'none';
                dialogConfirm.removeEventListener('click', handleConfirm);
                dialogCancel.removeEventListener('click', handleCancel);
                resolve(false);
            };

            dialogConfirm.addEventListener('click', handleConfirm);
            dialogCancel.addEventListener('click', handleCancel);

            // Auto-hide dialog after 10 seconds as failsafe
            setTimeout(() => {
                if (!confirmationDialog.classList.contains('hidden')) {
                    handleCancel();
                }
            }, 10000);
        } catch (error) {
            console.error('Error showing confirmation dialog:', error);
            resolve(true); // Default to confirm if dialog fails
        }
    });
};

// Sort function - Add this function anywhere in your JS file
const toggleSort = () => {
    if (!state.activeCollection || !state.collections[state.activeCollection]) return;
    
    // Reverse the items array
    state.collections[state.activeCollection].reverse();
    sortReversed = !sortReversed;
    
    // Update visual indicator
    sortBtn.style.transform = sortReversed ? 'rotate(180deg)' : 'rotate(0deg)';
    
    // Save and re-render
    saveData();
    renderItems();
    
    console.log('Items sorted, reversed:', sortReversed);
};

// Function to show/hide sticky controls
const updateStickyControls = (show) => {
    if (stickyControls) {
        if (show) {
            stickyControls.classList.add('show');
        } else {
            stickyControls.classList.remove('show');
        }
    }
};


// FIXED: Hide any stuck dialogs
const hideAllDialogs = () => {
    if (confirmationDialog) {
        confirmationDialog.classList.add('hidden');
        confirmationDialog.style.display = 'none';
    }

    // Close dropdown menu
    if (dropdownMenu) {
        dropdownMenu.classList.remove('show');
    }
};

// Local Export/Import Functions
const exportBackup = async () => {
    try {
        const backupData = {
            collections: state.collections,
            collectionsOrder: state.collectionsOrder,
            exportDate: new Date().toISOString(),
            version: '2.1'
        };
        
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        const url = URL.createObjectURL(blob);
        const filename = `chrome-collections-backup-${new Date().toISOString().split('T')[0]}.json`;
        
        // Use Chrome downloads API for better UX
        if (chrome.downloads) {
            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error('Download failed:', chrome.runtime.lastError);
                    // Fallback to direct download
                    downloadDirectly(url, filename);
                } else {
                    console.log('Backup exported successfully');
                }
                URL.revokeObjectURL(url);
            });
        } else {
            // Fallback for older browsers
            downloadDirectly(url, filename);
        }
        
        if (dropdownMenu) dropdownMenu.classList.remove('show');
        
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export backup. Please try again.');
    }
};

const downloadDirectly = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const importBackup = () => {
    if (fileInput) {
        fileInput.click();
    }
    if (dropdownMenu) dropdownMenu.classList.remove('show');
};

const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const backupData = JSON.parse(text);
        
        // Validate backup data
        if (!backupData.collections || !backupData.collectionsOrder) {
            throw new Error('Invalid backup file format');
        }
        
        // Confirm import
        const confirmed = await showConfirmDialog(
            'Import Backup',
            `This will replace all your current collections with the backup from ${backupData.exportDate ? new Date(backupData.exportDate).toLocaleDateString() : 'Unknown date'}. Continue?`
        );
        
        if (confirmed) {
            // Import data
            state.collections = backupData.collections;
            state.collectionsOrder = backupData.collectionsOrder;
            
            // Save to local storage
            saveData();
            
            // Refresh UI
            showCollectionsView();
            renderCollections();
            
            alert('Backup imported successfully!');
            console.log('Backup imported successfully');
        }
        
    } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import backup. Please check the file format.');
    } finally {
        // Reset file input
        if (fileInput) fileInput.value = '';
    }
};

// Rename functions
const renameCollection = async (oldName) => {
    const newName = prompt('Rename collection:', oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    
    const trimmedName = newName.trim();
    
    // Check if new name already exists
    if (state.collections[trimmedName]) {
        alert('A collection with this name already exists!');
        return;
    }
    
    // Rename collection
    state.collections[trimmedName] = state.collections[oldName];
    delete state.collections[oldName];
    
    // Update order array
    const index = state.collectionsOrder.indexOf(oldName);
    if (index !== -1) {
        state.collectionsOrder[index] = trimmedName;
    }
    
    // Update active collection if it was the renamed one
    if (state.activeCollection === oldName) {
        state.activeCollection = trimmedName;
        if (headerTitle) headerTitle.textContent = trimmedName;
    }
    
    saveData();
    renderCollections();
    console.log('Collection renamed from', oldName, 'to', trimmedName);
};

const renameItem = async (index) => {
    if (!state.activeCollection || !state.collections[state.activeCollection]) return;
    
    const item = state.collections[state.activeCollection][index];
    if (!item) return;
    
    let currentTitle = '';
    if (item.type === 'page') {
        currentTitle = item.title;
    } else if (item.type === 'text') {
        currentTitle = item.title || item.content.substring(0, 30);
    } else if (item.type === 'image') {
        currentTitle = item.title || 'Image';
    } else if (item.type === 'note') {
        currentTitle = item.content.substring(0, 30);
    }
    
    const newTitle = prompt('Rename item:', currentTitle);
    if (!newTitle || !newTitle.trim() || newTitle.trim() === currentTitle) return;
    
    // Update item title/content based on type
    if (item.type === 'note') {
        item.content = newTitle.trim();
    } else {
        item.title = newTitle.trim();
    }
    
    saveData();
    renderItems();
    console.log('Item renamed to:', newTitle.trim());
};

// Render functions
const renderCollections = () => {
    const isEmpty = state.collectionsOrder.length === 0;
    
    if (collectionsEmpty) {
        collectionsEmpty.style.display = isEmpty ? 'block' : 'none';
    }
    
    if (!collectionsList) return;
    
    collectionsList.innerHTML = '';
    
    state.collectionsOrder.forEach((name, index) => {
        if (!state.collections[name]) return; // Skip deleted collections
        
        const items = state.collections[name];
        const itemCount = items.length;
        const lastModified = items.length > 0 ? Math.max(...items.map(i => i.timestamp)) : Date.now();
        
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.dataset.collectionName = name;
        card.dataset.collectionIndex = index;
        
        card.innerHTML = `
            <div class="collection-header">
                <h3 class="collection-name">${escapeHTML(name)}</h3>
                <div class="collection-actions">
                    <button class="rename-collection" title="Rename Collection">
                        ✏️
                    </button>
                    <button class="delete-collection" title="Delete Collection">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="collection-info">
                <span class="item-count">${itemCount} items</span>
                <span class="last-modified">Modified ${formatDate(lastModified)}</span>
            </div>
        `;
        
        // Add click handler for opening collection
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.collection-actions')) {
                openCollection(name);
            }
        });
        
        // Add rename handler
        const renameBtn = card.querySelector('.rename-collection');
        if (renameBtn) {
            renameBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Rename collection clicked:', name);
                await renameCollection(name);
            });
        }
        
        // Add delete handler with proper event binding
        const deleteBtn = card.querySelector('.delete-collection');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Delete collection clicked:', name);
                
                const confirmed = await showConfirmDialog(
                    'Delete Collection',
                    `Are you sure you want to delete "${name}"? This action cannot be undone.`
                );
                
                if (confirmed) {
                    console.log('Confirmed delete collection:', name);
                    deleteCollection(name);
                }
            });
        }
        
        // Add drag and drop support for reordering
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            state.draggedCollectionIndex = index;
            e.dataTransfer.effectAllowed = 'move';
        });
        
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.classList.add('drag-over');
        });
        
        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });
        
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            
            if (state.draggedCollectionIndex !== null && state.draggedCollectionIndex !== index) {
                reorderCollection(state.draggedCollectionIndex, index);
            }
            state.draggedCollectionIndex = null;
        });
        
        collectionsList.appendChild(card);
    });
};

const renderItems = () => {
    if (!state.activeCollection || !state.collections[state.activeCollection]) {
        return;
    }
    
    const items = state.collections[state.activeCollection];
    const isEmpty = items.length === 0;
    
    if (itemsEmpty) {
        itemsEmpty.style.display = isEmpty ? 'block' : 'none';
    }
    
    if (!itemsList) return;
    
    itemsList.innerHTML = '';
    
    items.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-card';
        itemDiv.dataset.itemIndex = index;
        itemDiv.dataset.type = item.type; // Add data-type attribute
        
        let itemHTML = '';
        
        switch (item.type) {
            case 'page':
                itemHTML = `
                    <div class="item-content">
                        ${item.screenshot ? `<img src="${item.screenshot}" alt="Screenshot" class="item-screenshot">` : ''}
                        <div class="item-details">
                            <div class="item-header">
                                <img src="${item.favicon && item.favicon !== 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8z"/></svg>' ? item.favicon : ''}" 
                                     alt="Favicon" 
                                     class="item-favicon"
                                     data-domain="${item.domain || ''}"
                                     data-letter="${item.domain ? item.domain.charAt(0).toUpperCase() : 'W'}"
                                     onerror="this.src=''">
                                <h4 class="item-title">${escapeHTML(item.title)}</h4>
                                <div class="item-actions">
                                    <button class="rename-item" title="Rename Item">✏️</button>
                                    <button class="delete-item" title="Delete Item">🗑️</button>
                                </div>
                            </div>
                            <p class="item-description">${escapeHTML(item.description || '')}</p>
                            <div class="item-meta">
                                <span class="item-domain">${escapeHTML(item.domain)}</span>
                                <span class="item-date">${formatDate(item.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'text':
                itemHTML = `
                    <div class="item-content">
                        <div class="item-details">
                            <div class="item-header">
                                <span class="item-icon">📝</span>
                                <h4 class="item-title">${escapeHTML(item.title)}</h4>
                                <div class="item-actions">
                                    <button class="rename-item" title="Rename Item">✏️</button>
                                    <button class="delete-item" title="Delete Item">🗑️</button>
                                </div>
                            </div>
                            <p class="item-text-content">${escapeHTML(item.content)}</p>
                            <div class="item-meta">
                                <span class="item-domain">${escapeHTML(item.domain || '')}</span>
                                <span class="item-date">${formatDate(item.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'image':
                itemHTML = `
                    <div class="item-content">
                        <img src="${item.src}" alt="Image" class="item-image">
                        <div class="item-details">
                            <div class="item-header">
                                <span class="item-icon">🖼️</span>
                                <h4 class="item-title">${escapeHTML(item.title)}</h4>
                                <div class="item-actions">
                                    <button class="rename-item" title="Rename Item">✏️</button>
                                    <button class="delete-item" title="Delete Item">🗑️</button>
                                </div>
                            </div>
                            <div class="item-meta">
                                <span class="item-domain">${escapeHTML(item.domain || '')}</span>
                                <span class="item-date">${formatDate(item.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case 'note':
                itemHTML = `
                    <div class="item-content">
                        <div class="item-details">
                            <div class="item-header">
                                <span class="item-icon">📋</span>
                                <h4 class="item-title">Note</h4>
                                <div class="item-actions">
                                    <button class="rename-item" title="Edit Note">✏️</button>
                                    <button class="delete-item" title="Delete Item">🗑️</button>
                                </div>
                            </div>
                            <p class="item-text-content">${escapeHTML(item.content)}</p>
                            <div class="item-meta">
                                <span class="item-date">${formatDate(item.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                `;
                break;
        }
        
        itemDiv.innerHTML = itemHTML;
        
        // Add click handler for opening item
        itemDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.item-actions')) {
                openItem(item);
            }
        });
        
        // Add rename handler
        const renameBtn = itemDiv.querySelector('.rename-item');
        if (renameBtn) {
            renameBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Rename item clicked:', index);
                await renameItem(index);
            });
        }
        
        // Add delete handler with proper event binding
        const deleteBtn = itemDiv.querySelector('.delete-item');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Delete item clicked:', index);
                
                const confirmed = await showConfirmDialog(
                    'Delete Item',
                    'Are you sure you want to delete this item?'
                );
                
                if (confirmed) {
                    console.log('Confirmed delete item:', index);
                    deleteItem(index);
                }
            });
        }
        
        // Add drag support for reordering
        itemDiv.draggable = true;
        itemDiv.addEventListener('dragstart', (e) => {
            state.draggedItem = index;
            e.dataTransfer.effectAllowed = 'move';
        });
        
        itemDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            itemDiv.classList.add('drag-over');
        });
        
        itemDiv.addEventListener('dragleave', () => {
            itemDiv.classList.remove('drag-over');
        });
        
        itemDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            itemDiv.classList.remove('drag-over');
            
            if (state.draggedItem !== null && state.draggedItem !== index) {
                reorderItem(state.draggedItem, index);
            }
            state.draggedItem = null;
        });
        
        itemsList.appendChild(itemDiv);
    });
};

// Collection management functions
const createCollection = (name) => {
    if (!name.trim()) return;
    
    if (state.collections[name]) {
        alert('Collection already exists!');
        return;
    }
    
    state.collections[name] = [];
    state.collectionsOrder.push(name);
    saveData();
    renderCollections();
    
    if (newCollectionInput) {
        newCollectionInput.value = '';
    }
};

const deleteCollection = (name) => {
    console.log('Deleting collection:', name);
    delete state.collections[name];
    state.collectionsOrder = state.collectionsOrder.filter(n => n !== name);
    
    if (state.activeCollection === name) {
        state.activeCollection = null;
        showCollectionsView();
    }
    
    saveData();
    renderCollections();
    console.log('Collection deleted successfully');
};

const reorderCollection = (fromIndex, toIndex) => {
    const item = state.collectionsOrder.splice(fromIndex, 1)[0];
    state.collectionsOrder.splice(toIndex, 0, item);
    saveData();
    renderCollections();
};

const openCollection = (name) => {
    state.activeCollection = name;
    showItemsView();
};

// Item management functions
const addItemToCollection = (collectionName, item) => {
    if (!state.collections[collectionName]) {
        state.collections[collectionName] = [];
    }
    
    const itemId = generateItemId(item);
    const existingIndex = state.collections[collectionName].findIndex(i => generateItemId(i) === itemId);
    
    if (existingIndex !== -1) {
        state.collections[collectionName][existingIndex] = item;
    } else {
        state.collections[collectionName].push(item);
    }
    
    saveData();
    
    if (state.activeCollection === collectionName) {
        renderItems();
    }
};

const deleteItem = (index) => {
    console.log('Deleting item at index:', index);
    if (!state.activeCollection || !state.collections[state.activeCollection]) return;
    
    state.collections[state.activeCollection].splice(index, 1);
    saveData();
    renderItems();
    console.log('Item deleted successfully');
};

const reorderItem = (fromIndex, toIndex) => {
    if (!state.activeCollection || !state.collections[state.activeCollection]) return;
    
    const items = state.collections[state.activeCollection];
    const item = items.splice(fromIndex, 1)[0];
    items.splice(toIndex, 0, item);
    saveData();
    renderItems();
};

const openItem = (item) => {
    if (item.url) {
        chrome.tabs.create({ url: item.url });
    } else if (item.src) {
        chrome.tabs.create({ url: item.src });
    }
};

// FIXED: Add current page with smart collection detection
const addCurrentPage = async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            alert('Cannot add this type of page to collections.');
            return;
        }
        
        // If no collections exist, prompt to create one first
        if (state.collectionsOrder.length === 0) {
            const collectionName = prompt('Create a collection to save this page:');
            if (collectionName && collectionName.trim()) {
                createCollection(collectionName.trim());
                state.activeCollection = collectionName.trim();
            } else {
                return; // User cancelled
            }
        }
        
        // If no active collection but collections exist, prompt user
        if (!state.activeCollection && state.collectionsOrder.length > 1) {
            const collectionName = prompt(`Add to which collection?\nOptions: ${state.collectionsOrder.join(', ')}`);
            if (collectionName && state.collections[collectionName]) {
                state.activeCollection = collectionName;
            } else {
                return; // User cancelled or invalid selection
            }
        } else if (!state.activeCollection && state.collectionsOrder.length === 1) {
            // Only one collection exists, use it
            state.activeCollection = state.collectionsOrder[0];
        }
        
        chrome.runtime.sendMessage({
            type: 'ADD_CURRENT_PAGE'
        });
        
    } catch (error) {
        console.error('Error adding current page:', error);
    }
};

const addNote = () => {
    if (!newNoteInput || !state.activeCollection) return;
    
    const content = newNoteInput.value.trim();
    if (!content) return;
    
    const note = {
        type: 'note',
        content: content,
        timestamp: Date.now()
    };
    
    addItemToCollection(state.activeCollection, note);
    newNoteInput.value = '';
};

// View management - UPDATED for clean UI
const showCollectionsView = () => {
    if (collectionsView) collectionsView.style.display = 'block';
    if (itemsView) itemsView.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';
    if (headerTitle) headerTitle.textContent = 'Collections';
    if (dropdownMenu) dropdownMenu.classList.remove('show');
    state.activeCollection = null; // Clear active collection when going back to list
    renderCollections();
};

const showItemsView = () => {
    if (collectionsView) collectionsView.style.display = 'none';
    if (itemsView) itemsView.style.display = 'block';
    if (backBtn) backBtn.style.display = 'block';
    if (headerTitle) headerTitle.textContent = state.activeCollection;
    if (dropdownMenu) dropdownMenu.classList.remove('show');
    renderItems();
};

// Bulk actions
const openAllInTabs = () => {
    if (!state.activeCollection) return;
    
    const urls = state.collections[state.activeCollection]
        .filter(item => item.url)
        .map(item => item.url);
    
    if (urls.length > 0) {
        chrome.runtime.sendMessage({
            type: 'OPEN_URLS_IN_TAB_GROUP',
            urls: urls,
            groupTitle: state.activeCollection
        });
    }
    
    // Close dropdown
    if (dropdownMenu) dropdownMenu.classList.remove('show');
};

const openAllInWindow = () => {
    if (!state.activeCollection) return;
    
    const urls = state.collections[state.activeCollection]
        .filter(item => item.url)
        .map(item => item.url);
    
    if (urls.length > 0) {
        chrome.runtime.sendMessage({
            type: 'OPEN_URLS_IN_WINDOW',
            urls: urls,
            groupTitle: state.activeCollection
        });
    }
    
    // Close dropdown
    if (dropdownMenu) dropdownMenu.classList.remove('show');
};

const openAllInIncognito = () => {
    if (!state.activeCollection) return;
    
    const urls = state.collections[state.activeCollection]
        .filter(item => item.url)
        .map(item => item.url);
    
    if (urls.length > 0) {
        chrome.runtime.sendMessage({
            type: 'OPEN_URLS_IN_INCOGNITO',
            urls: urls,
            groupTitle: state.activeCollection
        });
    }
    
    // Close dropdown
    if (dropdownMenu) dropdownMenu.classList.remove('show');
};

const copyAllLinks = async () => {
    if (!state.activeCollection) return;
    
    const urls = state.collections[state.activeCollection]
        .filter(item => item.url)
        .map(item => item.url)
        .join('\n');
    
    if (urls) {
        try {
            await navigator.clipboard.writeText(urls);
            alert('Links copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy links:', error);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = urls;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert('Links copied to clipboard!');
            } catch (fallbackError) {
                console.error('Fallback copy failed:', fallbackError);
                alert('Failed to copy links to clipboard.');
            }
            document.body.removeChild(textArea);
        }
    }
    
    // Close dropdown
    if (dropdownMenu) dropdownMenu.classList.remove('show');
};

// Event listeners - UPDATED with menu functionality and export/import
const setupEventListeners = () => {
    // Collection creation
    if (addCollectionBtn) {
        addCollectionBtn.addEventListener('click', () => {
            const name = newCollectionInput ? newCollectionInput.value.trim() : '';
            createCollection(name);
        });
    }
    
    if (newCollectionInput) {
        newCollectionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const name = e.target.value.trim();
                createCollection(name);
            }
        });
    }
    
    // Navigation
    if (backBtn) {
        backBtn.addEventListener('click', showCollectionsView);
    }
    
    // Clean UI: Menu dropdown functionality
    if (menuBtn && dropdownMenu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }
    
    // Local Export/Import
    if (exportBackupBtn) {
        exportBackupBtn.addEventListener('click', exportBackup);
    }
    
    if (importBackupBtn) {
        importBackupBtn.addEventListener('click', importBackup);
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileImport);
    }
    
    // Add current page
    if (addCurrentPageBtn) {
        addCurrentPageBtn.addEventListener('click', addCurrentPage);
    }
    
    // Add note
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', addNote);
    }
    
    if (newNoteInput) {
        newNoteInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addNote();
            }
        });
    }
    
    // Bulk actions (now in dropdown menu)
    if (openAllTabsBtn) {
        openAllTabsBtn.addEventListener('click', openAllInTabs);
    }
    
    if (openAllWindowBtn) {
        openAllWindowBtn.addEventListener('click', openAllInWindow);
    }
    
    if (openAllIncognitoBtn) {
        openAllIncognitoBtn.addEventListener('click', openAllInIncognito);
    }
    
    if (copyAllLinksBtn) {
        copyAllLinksBtn.addEventListener('click', copyAllLinks);
    }
    
    // Drag and drop for the drop zone
    if (dragDropZone) {
        dragDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dragDropZone.classList.add('drag-over');
        });
        
        dragDropZone.addEventListener('dragleave', () => {
            dragDropZone.classList.remove('drag-over');
        });
        
        dragDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDropZone.classList.remove('drag-over');
            
            // Handle text drops
            const text = e.dataTransfer.getData('text/plain');
            if (text && state.activeCollection) {
                // Check if it's a URL
                try {
                    new URL(text);
                    // It's a URL, add as page
                    const pageItem = {
                        type: 'page',
                        title: text,
                        url: text,
                        domain: new URL(text).hostname,
                        timestamp: Date.now(),
                        description: 'Dragged URL'
                    };
                    addItemToCollection(state.activeCollection, pageItem);
                } catch {
                    // It's plain text
                    const textItem = {
                        type: 'text',
                        content: text,
                        title: `Text: ${text.substring(0, 30)}...`,
                        timestamp: Date.now()
                    };
                    addItemToCollection(state.activeCollection, textItem);
                }
            }
        });
    }
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key closes dropdown and dialogs
        if (e.key === 'Escape') {
            if (dropdownMenu) dropdownMenu.classList.remove('show');
            if (confirmationDialog && !confirmationDialog.classList.contains('hidden')) {
                confirmationDialog.classList.add('hidden');
                confirmationDialog.style.display = 'none';
            }
        }
    });
};

// FIXED: Message handling - Smart collection detection
const handleMessages = () => {
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'ADD_ITEM_TO_COLLECTION') {
            const item = message.payload;
            
            // If no collections exist, prompt to create one
            if (state.collectionsOrder.length === 0) {
                const collectionName = prompt('Create a collection to save this item:');
                if (collectionName && collectionName.trim()) {
                    state.collections[collectionName.trim()] = [];
                    state.collectionsOrder.push(collectionName.trim());
                    addItemToCollection(collectionName.trim(), item);
                    renderCollections();
                }
                return;
            }
            
            // If we're currently viewing a collection (active collection exists), add to it
            if (state.activeCollection && state.collections[state.activeCollection]) {
                console.log('Adding to active collection:', state.activeCollection);
                addItemToCollection(state.activeCollection, item);
                return;
            }
            
            // If only one collection exists and no active collection, add to the only one
            if (state.collectionsOrder.length === 1) {
                console.log('Adding to only collection:', state.collectionsOrder[0]);
                addItemToCollection(state.collectionsOrder[0], item);
                return;
            }
            
            // Multiple collections exist but no active collection - let user choose
            // This should only happen when user is on collections view
            const collectionName = prompt(`Add to which collection?\nOptions: ${state.collectionsOrder.join(', ')}`);
            if (collectionName && state.collections[collectionName]) {
                addItemToCollection(collectionName, item);
            }
        }
    });
};

// FIXED: Initialize with proper error handling and dialog clearing
const initialize = async () => {
    try {
        // Clear any stuck dialogs immediately
        clearStuckDialogs();
        hideAllDialogs();
        
        console.log('Initializing Collections...');
        
        // Load data first
        await loadData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup message handling
        handleMessages();
        
        // Show initial view
        showCollectionsView();
        
        // Initialization complete - allow dialogs now
        isInitializing = false;
        
        console.log('Collections initialized successfully');
    } catch (error) {
        console.error('Error during initialization:', error);
        isInitializing = false; // Still allow dialogs even if initialization fails
        
        // Show collections view anyway
        showCollectionsView();
    }
};

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
