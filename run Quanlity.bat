@echo off
echo stoping Node.js...
taskkill /F /IM node.exe
echo Stoped!
cd ./src && node quanlity.js --thread=6