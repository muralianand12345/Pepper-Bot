const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const logsBasePath = path.join(__dirname, '../../logs');
const logFilePath = generateLogFilePath();

module.exports = {
    success: (message) => {
        const logMessage = `${getCurrentTimestamp()} ${chalk.green('[SUCCESS]')} ${message}`;
        console.log(chalk.green('[SUCCESS]'), message);
        writeToLogFile(logMessage);
    },
    log: (message) => {
        const logMessage = `${getCurrentTimestamp()} ${chalk.white('[LOG]')} ${message}`;
        console.log(chalk.white('[LOG]'), message);
        writeToLogFile(logMessage);
    },
    info: (message) => {
        const logMessage = `${getCurrentTimestamp()} ${chalk.blue('[INFO]')} ${message}`;
        console.log(chalk.blue('[INFO]'), message);
        writeToLogFile(logMessage);
    },
    warn: (message) => {
        const logMessage = `${getCurrentTimestamp()} ${chalk.yellow('[WARNING]')} ${message}`;
        console.warn(chalk.yellow('[WARNING]'), message);
        writeToLogFile(logMessage);
    },
    error: (message) => {
        const logMessage = `${getCurrentTimestamp()} ${chalk.red('[ERROR]')} ${message}`;
        console.error(chalk.red('[ERROR]'), message);
        writeToLogFile(logMessage);
    },
    debug: (message) => {
        const logMessage = `${getCurrentTimestamp()} ${chalk.magenta('[DEBUG]')} ${message}`;
        console.debug(chalk.magenta('[DEBUG]'), message);
        writeToLogFile(logMessage);
    },
};

function getCurrentTimestamp() {
    const now = new Date();
    return `[${now.toISOString()}]`;
}

function writeToLogFile(logMessage) {
    const logWithoutColor = logMessage.replace(/\x1b\[[0-9;]*m/g, '');
    fs.appendFileSync(logFilePath, logWithoutColor + '\n', 'utf8');
}

function generateLogFilePath() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('default', { month: 'long' });
    const day = now.getDate();
    const formattedDate = `${year}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    const yearFolderPath = path.join(logsBasePath, year.toString());
    const monthFolderPath = path.join(yearFolderPath, month);

    if (!fs.existsSync(yearFolderPath)) {
        fs.mkdirSync(yearFolderPath);
    }

    if (!fs.existsSync(monthFolderPath)) {
        fs.mkdirSync(monthFolderPath);
    }

    const fileName = `bot-log-${formattedDate}.log`;
    return path.join(monthFolderPath, fileName);
}