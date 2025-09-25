# Chrome Tab Collections

**MS Edge Collections feature replicated for Chrome via extensions.**

## Features
- Create, organize, and manage collections of Chrome tabs
- Easy tab recovery and access via a sidebar/sidepanel
- Save tab combos and revisit sets instantly

## Folder Structure
```
chrome-tab-collections/
├── background.js
├── content.js
├── manifest.json
├── sidepanel.css
├── sidepanel.html
├── sidepanel.js
├── icons/
├── LICENSE
```

## Installation & Usage (Local Development)
### Prerequisites
- **Google Chrome** browser
- Chrome extension development enabled

### Steps
1. **Clone this repo**
    ```bash
    git clone https://github.com/MishrajiAryan/chrome-tab-collections.git
    cd chrome-tab-collections
    ```
2. **Open Chrome Extension Page**
    - Go to: `chrome://extensions`
3. **Enable Developer Mode**
    - Toggle "Developer mode" (top-right)
4. **Load Unpacked Extension**
    - Click "Load unpacked"
    - Select the cloned repo folder (`chrome-tab-collections/`)
5. **Pin and Use**
    - The extension should now appear in your Chrome extensions bar.
    - Open the sidepanel to start using tab collections.

## Customization
- Add your own icons in the `icons` folder as needed.
- Modify `sidepanel.html/css/js` for custom UI.

## License
Licensed under the GPL-3.0 License.
