import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

interface Logger {
    success: (message: string) => void;
    log: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
    info: (message: string) => void;
    debug: (message: string) => void;
}

const getCurrentTimestamp = () => {
    const date: Date = new Date();
    return `[${date.toISOString()}]`;
};

const writeToLogFile = (logMessage: string, logFilePath: string) => {
    const logWithoutColor: string = logMessage.replace(/\u001b\[\d+m/g, '');
    fs.appendFileSync(logFilePath, logWithoutColor + '\n', 'utf8');
}

const generateLogFilePath = (logsBasePath: string) => {
    const now: Date = new Date();
    const year: number = now.getFullYear();
    const month: string = now.toLocaleDateString('default', { month: 'long' });
    const day: number = now.getDate();
    const formattedDate: string = `${year}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    const yearFolderPath: string = path.join(logsBasePath, year.toString());
    const monthFolderPath: string = path.join(yearFolderPath, month);

    if (!fs.existsSync(logsBasePath)) {
        fs.mkdirSync(logsBasePath, { recursive: true });
    }

    if (!fs.existsSync(yearFolderPath)) {
        fs.mkdirSync(yearFolderPath);
    }

    if (!fs.existsSync(monthFolderPath)) {
        fs.mkdirSync(monthFolderPath);
    }

    const fileName: string = `bot-log-${formattedDate}.log`;
    return path.join(monthFolderPath, fileName);
}

const logsBasePath: string = path.join(__dirname, '../../logs');
const logFilePath: string = generateLogFilePath(logsBasePath);

const logger: Logger = {
    success: (message: string): void => {
        const logMessage: string = `${getCurrentTimestamp()} ${chalk.green('SUCCESS')} ${message}`;
        console.log(chalk.green('[SUCCESS]'), message);
        writeToLogFile(logMessage, logFilePath);
    },
    log: (message: string): void => {
        const logMessage: string = `${getCurrentTimestamp()} ${chalk.blue('LOG')} ${message}`;
        console.log(chalk.blue('[LOG]'), message);
        writeToLogFile(logMessage, logFilePath);
    },
    error: (message: string): void => {
        const logMessage: string = `${getCurrentTimestamp()} ${chalk.red('ERROR')} ${message}`;
        console.log(chalk.red('[ERROR]'), message);
        writeToLogFile(logMessage, logFilePath);
    },
    warn: (message: string): void => {
        const logMessage: string = `${getCurrentTimestamp()} ${chalk.yellow('WARN')} ${message}`;
        console.log(chalk.yellow('[WARN]'), message);
        writeToLogFile(logMessage, logFilePath);
    },
    info: (message: string): void => {
        const logMessage: string = `${getCurrentTimestamp()} ${chalk.cyan('INFO')} ${message}`;
        console.log(chalk.cyan('[INFO]'), message);
        writeToLogFile(logMessage, logFilePath);
    },
    debug: (message: string): void => {
        const logMessage: string = `${getCurrentTimestamp()} ${chalk.magenta('DEBUG')} ${message}`;
        console.log(chalk.magenta('[DEBUG]'), message);
        writeToLogFile(logMessage, logFilePath);
    }
};

export default logger;