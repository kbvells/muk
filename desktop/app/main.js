// KeeWeb launcher script

// This script is distributed with the app and is its entry point
// It checks whether the app is available in userData folder and if its version is higher than local, launches it
// This script is the only part which will be updated only with the app itself, auto-update will not change it

// (C) Antelle 2017, MIT license https://github.com/keeweb/keeweb

const app = require('electron').app;
const path = require('path');
const fs = require('original-fs');

const userDataDir = app.getPath('userData');
const userDataAppArchivePath = path.join(userDataDir, 'app.asar');
let entryPointDir = __dirname;

try {
    const appFilePath = entryPointDir.endsWith('app.asar') ? entryPointDir : __filename;
    let userPackageStat;
    try {
        userPackageStat = fs.statSync(userDataAppArchivePath);
    } catch (e) {}
    if (userPackageStat) {
        const packageStat = fs.statSync(appFilePath);
        const userPackageStatTime = Math.max(userPackageStat.mtime.getTime(), userPackageStat.ctime.getTime());
        const packageStatTime = Math.max(packageStat.mtime.getTime(), packageStat.ctime.getTime());
        if (userPackageStatTime > packageStatTime) {
            let versionLocal = require('./package.json').version;
            let versionUserData = require(path.join(userDataAppArchivePath, 'package.json')).version;
            versionLocal = versionLocal.split('.');
            versionUserData = versionUserData.split('.');
            for (let i = 0; i < versionLocal.length; i++) {
                if (+versionUserData[i] > +versionLocal[i]) {
                    entryPointDir = userDataAppArchivePath;
                    try {
                        validateSignature(userDataDir);
                    } catch (e) {
                        exitWithError('Error validating signatures: ' + e);
                    }
                    break;
                }
                if (+versionUserData[i] < +versionLocal[i]) {
                    break;
                }
            }
        }
    }
} catch (e) {
    console.error('Error reading user file version', e); // eslint-disable-line no-console
}
const entryPointFile = path.join(entryPointDir, 'app.js');
require(entryPointFile);

function validateSignature(appPath) {
    const signatures = JSON.parse(fs.readFileSync(path.join(appPath, 'signatures.json')));
    const selfSignature = signatures.kwResSelf;
    if (!selfSignature || !signatures['app.asar']) {
        exitWithError('Invalid signature file');
    }
    delete signatures.kwResSelf;
    const data = JSON.stringify(signatures);
    validateDataSignature(Buffer.from(data), selfSignature, 'self');
    Object.keys(signatures).forEach(signedFilePath => {
        const resourcePath = path.join(appPath, signedFilePath);
        const fileData = fs.readFileSync(resourcePath);
        validateDataSignature(fileData, signatures[signedFilePath], signedFilePath);
    });
}

function validateDataSignature(data, signature, name) {
    const crypto = require('crypto');
    const verify = crypto.createVerify('RSA-SHA256');
    let publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0oZB2Kt7AzRFNqf8FuO3
C3kepHPAIQYiDPYdQxHcsiaFCwyKVx6K1cE/3vBhb8/2rj+QIIWNfAAuu1Y+2VK9
0ZBeq6HciukWzQRO/HWhfdy0c7JwDAslmyGI5olj0ZQkNLhkde1MiMxjDPpRhZtd
JaryVO5cFJaJESpv3dV6m0qXsaQCluWYOSNfSjP9C8o2zRVjSi3ZQZnZIV5pnk9K
2MtlZIPXrN9iJiM5zZ9DTSnqApI6dC9mX4R3LvGN+GTovm9C8Crl+qb106nGRR3L
cweicDnPyMtZLa/E0DBpWYxUVLDp6WeLhxoUBr+6+t3Xp9IDnPoANDQXJXD0f1vQ
xQIDAQAB
-----END PUBLIC KEY-----`;
    if (publicKey.startsWith('@@')) {
        publicKey = fs.readFileSync('app/resources/public-key.pem', {encoding: 'utf8'}).trim();
    }
    verify.write(data);
    verify.end();
    signature = Buffer.from(signature, 'base64');
    if (!verify.verify(publicKey, signature)) {
        exitWithError('Resource corrupted: ' + name);
    }
}

function exitWithError(err) {
    console.error(err); // eslint-disable-line no-console
    process.exit(1);
}
