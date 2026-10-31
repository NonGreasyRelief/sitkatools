plugins {
    alias(libs.plugins.android.application)
}

// The app ships the repo's own SitkaTools/SitkaTools.html, copied byte for byte at build time into the APK's assets
// (assets/SitkaTools/SitkaTools.html). The HTML itself stays build-free: this copy is the only step.
abstract class CopyWebApp : DefaultTask() {
    @get:InputFile
    abstract val source: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun copy() {
        val out = outputDir.get().asFile.resolve("SitkaTools")
        out.deleteRecursively()
        out.mkdirs()
        source.get().asFile.copyTo(out.resolve("SitkaTools.html"), overwrite = true)
    }
}

val copyWebApp = tasks.register<CopyWebApp>("copyWebApp") {
    source.set(rootProject.layout.projectDirectory.file("../SitkaTools/SitkaTools.html"))
}

android {
    namespace = "com.sitkalegends.sitkatools"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        // The application id (sitkalegends.com reversed) is part of the Microsoft sign-in redirect (phase B): changing it means a new registration, and tablets lose their settings
        applicationId = "com.sitkalegends.sitkatools"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"
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

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyWebApp, CopyWebApp::outputDir)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
    testImplementation(libs.junit)
}
