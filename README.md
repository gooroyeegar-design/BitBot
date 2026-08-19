# BitBot 🤖

A mobile-first React virtual pet packaged for Android with Capacitor.

## Run
npm install
npm run dev

## Build Android APK
npm run apk:debug

The debug APK is created at:
`android/app/build/outputs/apk/debug/app-debug.apk`

## Android Studio
`npm run cap:sync` then `npm run cap:open`

## Notes
- BitBot stores pet state locally on the device.
- The microphone uses the browser/WebView Speech Recognition API when available and falls back to a simulated response when unavailable.
- The app is portrait-oriented and designed for phone touch interaction.

## Easiest APK build from a phone

The repository includes `.github/workflows/android.yml`. Push this project to GitHub, then open **Actions → Build BitBot APK → Run workflow**. When it finishes, download the `BitBot-debug-apk` artifact and install the APK on Android.

This route is useful if the phone does not have the Android SDK/Gradle toolchain installed.
