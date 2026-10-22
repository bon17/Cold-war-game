@echo off
chcp 65001 >nul
cd /d "%~dp0"
where npm >nul 2>nul || goto :nonode
echo [1/3] 필요한 프로그램을 확인합니다...
call npm install || goto :error
echo [2/3] 그림을 준비합니다...
call npm run assets || goto :error
echo [3/3] 체험판을 엽니다. 끝내려면 이 창을 닫으세요.
call npm run dev -- --open
goto :eof

:nonode
echo Node.js가 없습니다. https://nodejs.org 에서 LTS 판을 설치한 뒤 다시 실행해 주세요.
pause
exit /b 1

:error
echo 문제가 생겼습니다. 이 창의 글을 Claude에게 보여 주세요.
pause
exit /b 1
