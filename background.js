// Open the side panel on toolbar icon click
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Setup context menus
function setupContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'add-page-to-collection',
            title: 'Add page to Collection',
            contexts: ['page']
        });

        chrome.contextMenus.create({
            id: 'add-selection-to-collection',
            title: 'Add selection to Collection',
            contexts: ['selection']
        });

        chrome.contextMenus.create({
            id: 'add-image-to-collection',
            title: 'Add image to Collection',
            contexts: ['image']
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    setupContextMenu();
});

// Function to inject into page for data extraction
function getPageData() {
    const description = document.querySelector('meta[name="description"]')?.content ||
                       document.querySelector('meta[property="og:description"]')?.content ||
                       document.body.innerText.substring(0, 200) + '...';
    return { description };
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
        const collectionItem = {
            timestamp: Date.now(),
            tabId: tab.id,
            windowId: tab.windowId
        };

        if (info.menuItemId === 'add-page-to-collection') {
            // Capture screenshot
            let screenshot = null;
            try {
                screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
                    format: 'png'
                });
            } catch (error) {
                console.log('Screenshot capture failed:', error);
            }

            // Get page content
            let pageData = { description: '' };
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: getPageData
                });
                pageData = results[0].result;
            } catch (error) {
                console.log('Page data extraction failed:', error);
            }

            collectionItem.type = 'page';
            collectionItem.title = tab.title;
            collectionItem.url = tab.url;
            collectionItem.favicon = tab.favIconUrl;
            collectionItem.screenshot = screenshot;
            collectionItem.description = pageData.description;
            collectionItem.domain = new URL(tab.url).hostname;

        } else if (info.menuItemId === 'add-selection-to-collection') {
            collectionItem.type = 'text';
            collectionItem.content = info.selectionText;
            collectionItem.url = tab.url;
            collectionItem.title = `Text from ${tab.title}`;
            collectionItem.domain = new URL(tab.url).hostname;

        } else if (info.menuItemId === 'add-image-to-collection') {
            collectionItem.type = 'image';
            collectionItem.src = info.srcUrl;
            collectionItem.url = tab.url;
            collectionItem.title = `Image from ${tab.title}`;
            collectionItem.domain = new URL(tab.url).hostname;
        }

        // Open side panel and send data with delay
        chrome.sidePanel.open({ windowId: tab.windowId }, () => {
            setTimeout(() => {
                chrome.runtime.sendMessage({
                    type: 'ADD_ITEM_TO_COLLECTION',
                    payload: collectionItem
                });
            }, 1000); // Increased delay to ensure panel is fully loaded
        });

    } catch (error) {
        console.error('Context menu handler error:', error);
    }
});

// Handle messages from sidepanel
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    try {
        if (request.type === 'ADD_CURRENT_PAGE') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const collectionItem = {
                timestamp: Date.now(),
                tabId: tab.id,
                windowId: tab.windowId,
                type: 'page',
                title: tab.title,
                url: tab.url,
                favicon: tab.favIconUrl,
                domain: new URL(tab.url).hostname
            };

            // Try to capture screenshot
            try {
                collectionItem.screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
                    format: 'png'
                });
            } catch (error) {
                console.log('Screenshot capture failed:', error);
            }

            // Try to get page description
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: getPageData
                });
                collectionItem.description = results[0].result.description;
            } catch (error) {
                console.log('Page data extraction failed:', error);
                collectionItem.description = '';
            }

            // Send to sidepanel
            chrome.runtime.sendMessage({
                type: 'ADD_ITEM_TO_COLLECTION',
                payload: collectionItem
            });

        } else if (request.type === 'OPEN_URLS_IN_TAB_GROUP') {
            // Open all URLs in a new tab group
            const { urls, groupTitle } = request;
            
            // Create tabs first
            const tabIds = [];
            for (const url of urls) {
                const tab = await chrome.tabs.create({ url, active: false });
                tabIds.push(tab.id);
            }

            // Group the tabs
            if (tabIds.length > 0) {
                const groupId = await chrome.tabs.group({ tabIds });
                await chrome.tabGroups.update(groupId, {
                    title: groupTitle || 'Collection',
                    color: 'blue'
                });
            }

        } else if (request.type === 'OPEN_URLS_IN_WINDOW') {
            // Open all URLs in a new window with tab group
            const { urls, groupTitle } = request;
            
            if (urls.length > 0) {
                // Create new window with first URL
                const window = await chrome.windows.create({
                    url: urls[0],
                    type: 'normal'
                });
                
                const tabIds = [window.tabs[0].id];

                // Add remaining URLs as tabs
                for (let i = 1; i < urls.length; i++) {
                    const tab = await chrome.tabs.create({
                        url: urls[i],
                        windowId: window.id,
                        active: false
                    });
                    tabIds.push(tab.id);
                }

                // Group all tabs
                if (tabIds.length > 0) {
                    const groupId = await chrome.tabs.group({ tabIds });
                    await chrome.tabGroups.update(groupId, {
                        title: groupTitle || 'Collection',
                        color: 'green'
                    });
                }
            }

        } else if (request.type === 'OPEN_URLS_IN_INCOGNITO') {
            // Open all URLs in incognito window with tab group
            const { urls, groupTitle } = request;
            
            if (urls.length > 0) {
                // Create incognito window with first URL
                const window = await chrome.windows.create({
                    url: urls[0],
                    incognito: true,
                    type: 'normal'
                });
                
                const tabIds = [window.tabs[0].id];

                // Add remaining URLs as tabs
                for (let i = 1; i < urls.length; i++) {
                    const tab = await chrome.tabs.create({
                        url: urls[i],
                        windowId: window.id,
                        active: false
                    });
                    tabIds.push(tab.id);
                }

                // Group all tabs
                if (tabIds.length > 0) {
                    const groupId = await chrome.tabs.group({ tabIds });
                    await chrome.tabGroups.update(groupId, {
                        title: groupTitle || 'Collection',
                        color: 'orange'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Message handler error:', error);
    }
});
