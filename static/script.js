document.addEventListener('DOMContentLoaded', () => {
    // Tab functionality
    initializeTabs();

    // WebSocket demo functionality
    initializeWebSocketDemo();
});

/**
 * Initialize tab switching functionality
 */
const initializeTabs = () => {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');

            // Deactivate all tabs
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activate selected tab
            tab.classList.add('active');
            document.querySelector(`.tab-content[data-tab="${tabName}"]`).classList.add('active');
        });
    });
};

/**
 * Initialize WebSocket demo console
 */
const initializeWebSocketDemo = () => {
    let ws = null;
    const consoleOutput = document.getElementById('console-output');
    const messageInput = document.getElementById('message-input');
    const serverUrlInput = document.getElementById('server-url');
    const connectButton = document.getElementById('connect-button');
    const sendButton = document.getElementById('send-button');

    // Log message to console
    const logToConsole = (message, type = 'info') => {
        const logDiv = document.createElement('div');
        logDiv.className = `console-log log-${type}`;
        logDiv.textContent = message;
        consoleOutput.appendChild(logDiv);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    };

    // Format JSON for display
    const formatJson = (json) => {
        try {
            return JSON.stringify(JSON.parse(json), null, 2);
        } catch (e) {
            return json;
        }
    };

    // Connect/Disconnect button handler
    connectButton.addEventListener('click', () => {
        const url = serverUrlInput.value.trim();

        // If already connected, disconnect
        if (ws) {
            ws.close();
            ws = null;
            messageInput.disabled = true;
            sendButton.disabled = true;
            connectButton.textContent = 'Connect';
            logToConsole('Disconnected from WebSocket', 'warning');
            return;
        }

        if (!url) {
            logToConsole('Please enter a WebSocket URL', 'error');
            return;
        }

        try {
            // Create new connection
            ws = new WebSocket(url);

            // Connection open
            ws.addEventListener('open', (event) => {
                logToConsole(`Connected to ${url}`, 'success');
                messageInput.disabled = false;
                sendButton.disabled = false;
                connectButton.textContent = 'Disconnect';

                // Add authentication template
                messageInput.value = JSON.stringify({
                    type: 'auth',
                    data: {
                        apiKey: 'your-api-key-here'
                    }
                });
            });

            // Connection message
            ws.addEventListener('message', (event) => {
                logToConsole(`<< ${formatJson(event.data)}`, 'info');
            });

            // Connection error
            ws.addEventListener('error', (event) => {
                logToConsole('WebSocket error', 'error');
            });

            // Connection close
            ws.addEventListener('close', (event) => {
                logToConsole(`Connection closed: ${event.code} ${event.reason}`, 'warning');
                messageInput.disabled = true;
                sendButton.disabled = true;
                connectButton.textContent = 'Connect';
                ws = null;
            });

        } catch (error) {
            logToConsole(`Error: ${error.message}`, 'error');
        }
    });

    // Send button handler
    sendButton.addEventListener('click', () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            logToConsole('WebSocket is not connected', 'error');
            return;
        }

        const message = messageInput.value.trim();
        if (!message) {
            logToConsole('Please enter a message', 'error');
            return;
        }

        try {
            // Validate JSON
            JSON.parse(message);

            // Send message
            ws.send(message);
            logToConsole(`>> ${formatJson(message)}`, 'success');

        } catch (error) {
            logToConsole(`Invalid JSON: ${error.message}`, 'error');
        }
    });

    // Input keypress handler (for Enter key)
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });

    // Example commands menu (Optional enhancement)
    const addExampleCommands = () => {
        const exampleCommands = [
            {
                name: 'Authentication',
                command: {
                    type: 'auth',
                    data: {
                        apiKey: 'your-api-key-here'
                    }
                }
            },
            {
                name: 'Play song',
                command: {
                    type: 'play',
                    data: {
                        guildId: '1234567890',
                        query: 'bohemian rhapsody',
                        userId: '9876543210'
                    }
                }
            },
            {
                name: 'Now playing',
                command: {
                    type: 'now_playing',
                    data: {
                        guildId: '1234567890'
                    }
                }
            },
            {
                name: 'Pause playback',
                command: {
                    type: 'pause',
                    data: {
                        guildId: '1234567890'
                    }
                }
            }
        ];

        // Create example commands dropdown or buttons
        // Implementation left for future enhancement
    };
};

/**
 * Utility function to copy code blocks to clipboard when clicked
 */
const setupCodeCopyFeature = () => {
    document.querySelectorAll('pre code').forEach(block => {
        block.addEventListener('click', () => {
            const text = block.textContent;
            navigator.clipboard.writeText(text).then(
                () => {
                    // Visual feedback on successful copy
                    const originalBackground = block.parentElement.style.background;
                    block.parentElement.style.background = '#3A3D44';
                    setTimeout(() => {
                        block.parentElement.style.background = originalBackground;
                    }, 200);
                },
                () => console.error('Failed to copy code')
            );
        });
        // Add title as hint
        block.parentElement.title = 'Click to copy';
        block.parentElement.style.cursor = 'pointer';
    });
};

// Call the code copy feature setup
setupCodeCopyFeature();