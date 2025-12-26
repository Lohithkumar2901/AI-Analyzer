# Safety AI Analyzer

A web application for analyzing factory near misses and incidents using AI, automating correlation detection and report generation.

## Features
- Upload Excel files for near misses and incidents
- Automated analysis to find correlations (by location/type)
- Interactive charts (Chart.js)
- Downloadable Excel report of findings
- Modern UI with Bootstrap

## Tech Stack
- Frontend: HTML, CSS, JS, Bootstrap, Chart.js
- Backend: Node.js, Express, multer, xlsx, ml.js

## Usage
1. Start the backend server:
   ```
   cd backend
   npm start
   ```
2. Open `frontend/index.html` in your browser (or access via backend server at http://localhost:3000)
3. Upload both Excel files and click Analyze
4. View results, charts, and download the report

## Folder Structure
- `backend/` - Node.js server and API
- `frontend/` - Static files for UI

## Customization
- Change the correlation key (e.g., 'Location') in backend `index.js` as needed to match your Excel columns.

## Requirements
- Node.js (v16+ recommended)

## License
MIT
