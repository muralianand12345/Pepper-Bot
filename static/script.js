document.addEventListener('DOMContentLoaded', async () => {
    const version = await fetch('../version').then(response => response.json());
    const versionElement = document.getElementById('version-tag');
    if (versionElement) {
        await new Promise(resolve => setTimeout(resolve, 500));
        versionElement.textContent = `v${version.version}`;
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });

                // Update active class
                document.querySelectorAll('.nav-item a').forEach(link => {
                    link.classList.remove('active');
                });
                this.classList.add('active');
            }
        });
    });

    // Active link on scroll
    window.addEventListener('scroll', () => {
        const sections = document.querySelectorAll('section');
        const navItems = document.querySelectorAll('.nav-item a');

        let currentSection = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;

            if (window.pageYOffset >= (sectionTop - 200)) {
                currentSection = section.getAttribute('id');
            }
        });

        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${currentSection}`) {
                item.classList.add('active');
            }
        });
    });

    // WebSocket console functionality
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
                logToConsole(`⬅️ ${formatJson(event.data)}`, 'info');
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
            logToConsole(`➡️ ${formatJson(message)}`, 'success');

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

    // Example command copy functionality
    document.querySelectorAll('.example-command-body pre').forEach(block => {
        block.addEventListener('click', () => {
            const code = block.textContent;
            navigator.clipboard.writeText(code);

            // Visual feedback
            block.style.opacity = '0.7';
            setTimeout(() => {
                block.style.opacity = '1';
            }, 200);

            if (messageInput) {
                messageInput.value = code;
            }
        });

        // Add title as hint
        block.title = 'Click to copy to clipboard and console';
        block.style.cursor = 'pointer';
    });
});