plugins {
    alias(libs.plugins.android.application)
}

// Nothing of the page is built into the app: it opens the SitkaTools.html in the tablet's SitkaTools folder.
android {
    namespace = "com.sitkatools.app"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        // Settle this before the app goes on the tablets: a new id is a new app (its folder and unsaved work start over)
        applicationId = "com.sitkatools.app"
        minSdk = 26
        targetSdk = 37
        versionCode = 2
        versionName = "0.2.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
}
