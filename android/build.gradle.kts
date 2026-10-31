// Kotlin is built into the Android Gradle plugin from 9.0: no separate Kotlin plugin
plugins {
    alias(libs.plugins.android.application) apply false
}
