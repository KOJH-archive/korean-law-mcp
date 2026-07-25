@echo off
rem Run the web server and open the dashboard in default browser

rem Build the TypeScript project
npm run build

rem Start the server
node build/web-server.js

rem Open the dashboard
start "" "http://localhost:3002"
