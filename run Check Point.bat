@echo off
echo stoping Node.js...
taskkill /F /IM node.exe
echo Stoped!
cd ./src && node checkPoint.js --thread=6