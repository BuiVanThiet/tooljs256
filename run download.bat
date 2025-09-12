@echo off
echo stoping Node.js...
taskkill /F /IM node.exe
echo Stoped!
cd ./src && node download.js --thread=8