@echo off
rem senior-ai installer for Windows: runs install.mjs with Node.js (see install.mjs for options).
where node >nul 2>nul || (echo Error: Node.js is required: https://nodejs.org 1>&2 & exit /b 2)
node "%~dp0install.mjs" %*
exit /b %ERRORLEVEL%
