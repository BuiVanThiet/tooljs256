@echo off
setlocal enabledelayedexpansion

:: === Nhập hoặc sửa đường dẫn thư mục gốc tại đây ===
set "RootFolder=C:\Users\admin\Desktop\auto-tiktok-shop-main\downloads"

:: === Kiểm tra thư mục có tồn tại không ===
if not exist "%RootFolder%" (
    echo Thư mục "%RootFolder%" không tồn tại.
    pause
    exit /b
)

:: === Tạo thư mục 0-ALL nếu chưa có ===
mkdir "%RootFolder%\0-ALL" 2>nul

:: === Duyệt qua tất cả file .xlsx trong các thư mục con ===
for /r "%RootFolder%" %%F in (*.xlsx) do (
    :: Bỏ qua nếu file đó đã nằm trong thư mục 0-ALL
    if /I not "%%~dpF"=="%RootFolder%\0-ALL\" (
        echo Di chuyen %%F
        move "%%F" "%RootFolder%\0-ALL\" >nul
    )
)

echo.
echo === Hoan thanh! Tat ca file .xlsx da duoc di chuyen vao 0-ALL ===
pause
