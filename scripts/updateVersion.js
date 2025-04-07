const fs = require('fs');
const path = require('path');

/**
 * Updates version information across project files based on the VERSION file
 * 
 * This function:
 * 1. Reads the current version from the VERSION file
 * 2. Updates package.json with the version number
 * 3. Updates the version badge in README.md
 * 
 * @returns {void}
 * @throws {Error} If any file operations fail
 */
const updateVersionInFiles = () => {
    try {
        // Read version from VERSION file
        const versionFilePath = path.join(process.cwd(), 'VERSION');
        const version = fs.readFileSync(versionFilePath, 'utf8').trim();

        console.log(`Updating project to version ${version}...`);

        // Update package.json
        const updatePackageJson = () => {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

            if (packageJson.version !== version) {
                packageJson.version = version;
                fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n');
                console.log('✅ Updated package.json');
            } else {
                console.log('ℹ️ package.json already at correct version');
            }
        };

        // Update README.md
        const updateReadme = () => {
            const readmePath = path.join(process.cwd(), 'README.md');
            let readmeContent = fs.readFileSync(readmePath, 'utf8');

            // Update the version badge
            const updatedReadme = readmeContent.replace(
                /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-([0-9]+\.[0-9]+\.[0-9]+)-blue\)/g,
                `![Version](https://img.shields.io/badge/version-${version}-blue)`
            );

            if (readmeContent !== updatedReadme) {
                fs.writeFileSync(readmePath, updatedReadme);
                console.log('✅ Updated README.md');
            } else {
                console.log('ℹ️ README.md already at correct version');
            }
        };

        // Execute updates
        updatePackageJson();
        updateReadme();

        console.log(`🚀 Successfully updated all files to version ${version}`);
    } catch (error) {
        console.error('❌ Error updating version:', error);
        process.exit(1);
    }
};

// Run the update
updateVersionInFiles();