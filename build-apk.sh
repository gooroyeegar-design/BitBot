#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
printf '\n🤖 BitBot APK builder\n\n'
command -v node >/dev/null || { echo 'Node.js is required. Install it with: pkg install nodejs-lts'; exit 1; }
command -v java >/dev/null || { echo 'Java is required. Install it with: pkg install openjdk-21'; exit 1; }
if [ ! -d node_modules ]; then npm install; fi
npm run build
if [ ! -d android ]; then npx cap add android; fi
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon
cp app/build/outputs/apk/debug/app-debug.apk ../BitBot-debug.apk
printf '\n✅ APK created: %s/BitBot-debug.apk\n' "$(cd .. && pwd)"
