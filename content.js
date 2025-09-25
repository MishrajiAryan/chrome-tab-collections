// Enhanced selection handling
document.addEventListener('mouseup', () => {
    const selection = window.getSelection().toString().trim();
    if (selection) {
        // Store selection for context menu
        window.selectedText = selection;
    }
});

// Message handling from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageData') {
        const data = {
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.content ||
                        document.querySelector('meta[property="og:description"]')?.content ||
                        document.body.innerText.substring(0, 200) + '...',
            favicon: document.querySelector('link[rel="icon"]')?.href ||
                    document.querySelector('link[rel="shortcut icon"]')?.href
        };
        sendResponse(data);
    }
});
