# Backlog Attachment Cleaner

A modern web application to bulk delete attachments from Backlog issues, with a user-friendly interface and advanced features.

## Features

- **Bulk Delete Attachments**: Remove files attached to issues and comments.
- **Search by Parent Issue**: Find and manage attachments for a parent issue and all its child issues.
- **Search by Issue Range**: Specify a range of issue keys to search and delete attachments.
- **Delete by Single Issue Key**: Instantly delete all attachments (body and comments) for a specified issue key.
- **Project Selection**: Select your target project from a dropdown after a successful connection.
- **Rate Limit Handling**: Automatic retry and wait for Backlog API rate limits (429 errors).
- **Progress and Result Display**: See detailed progress and completion messages, including success/failure counts.
- **Settings Persistence**: All input values are saved to browser localStorage and persist across reloads.
- **Modern UI**: Built with Chakra UI for a clean, responsive, and accessible experience.

## Security

⚠️ **Important Security Notice**

- **Client-side Only**: All operations are performed in your browser. No data is sent to any external server.
- **Local Storage**: API keys and settings are stored only in your browser's localStorage.
- **Direct API Communication**: The app communicates directly with the Backlog API.

**Recommendations:**
- Use on personal computers only.
- Clear browser history and cache after use, especially on shared devices.
- Use "Private Browsing" mode in shared environments.

## Usage

### 1. Online Version (Recommended)

**GitHub Pages**: https://kondo-masaki.github.io/backlog-attachment-cleaner/v2/

- No installation required.
- Always up-to-date.

### 2. Local Usage

```bash
git clone https://github.com/kondo-masaki/backlog-attachment-cleaner.git
cd backlog-attachment-cleaner
npm install
npm run dev
```

### 3. How to Use

1. **Settings**
   - Enter your Backlog Space URL (e.g., https://yourspace.backlog.jp)
   - Enter your API Key (from your Backlog personal settings)
   - Click "Test Connection" (projects will be loaded if successful)
   - Select your target project from the dropdown

2. **Search Options**
   - **By Parent Issue**: Enter a parent issue key (e.g., PROJECT-123) to find attachments for it and its child issues.
   - **By Issue Range**: Specify a range (e.g., PROJECT-100 to PROJECT-200) to find attachments in that range.

3. **Delete Attachments by Issue Key**
   - Enter a single issue key and delete all its attachments (body and comments) in one click.

4. **Bulk Operations**
   - After searching, select attachments to delete (or use "Select All").
   - Click "Delete Selected Files" to remove them.
   - A completion message will show the number of successful and failed deletions.
   - The results section will be hidden after deletion.

## Technical Specifications

- **Frontend**: React 18 + TypeScript
- **UI Library**: Chakra UI
- **Build Tool**: Webpack 5
- **API**: Axios
- **Supported Browsers**: Chrome, Firefox, Safari, Edge

## API Limitations

- Handles Backlog API rate limits and retries automatically.
- Adjusts deletion intervals to avoid errors.

## Development

```bash
npm run dev         # Start development server
npm run build       # Production build
npm run build:gh-pages  # Build for GitHub Pages
npm run deploy      # Deploy to GitHub Pages
```

## GitHub Pages Deployment

- Push to GitHub and set Pages source to "GitHub Actions" for automatic deployment.
- Or run `npm run deploy` for manual deployment.

## License

MIT License

## Disclaimer

The developer assumes no responsibility for any damages caused by the use of this tool.
Please backup your data and use at your own risk.

## Contributing

Please report bugs and feature requests through GitHub Issues.

