const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const dependencyBlock = '\ndependencies {';
    if (!config.modResults.contents.includes(dependencyBlock)) {
      throw new Error('Could not locate the Android app Gradle dependencies block');
    }

    const releaseSigning = `
def releaseKeystorePath = System.getenv('ANDROID_KEYSTORE_PATH')
if (releaseKeystorePath) {
    android {
        signingConfigs {
            release {
                storeFile file(releaseKeystorePath)
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }
        buildTypes {
            release {
                signingConfig signingConfigs.release
            }
        }
    }
}
`;

    config.modResults.contents = config.modResults.contents.replace(
      dependencyBlock,
      `${releaseSigning}\ndependencies {`,
    );
    return config;
  });
};
