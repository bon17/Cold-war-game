#!/bin/bash
# 맥에서 두 번 클릭하면 체험판을 연다(docs/local-test.md).
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null; then
  echo "Node.js가 없습니다. https://nodejs.org 에서 LTS 판을 설치한 뒤 다시 실행해 주세요."
  read -r
  exit 1
fi
echo "[1/3] 필요한 프로그램을 확인합니다..."
npm install || { echo "문제가 생겼습니다. 이 창의 글을 Claude에게 보여 주세요."; read -r; exit 1; }
echo "[2/3] 그림을 준비합니다..."
npm run assets || { echo "문제가 생겼습니다. 이 창의 글을 Claude에게 보여 주세요."; read -r; exit 1; }
echo "[3/3] 체험판을 엽니다. 끝내려면 이 창을 닫으세요."
npm run dev -- --open
