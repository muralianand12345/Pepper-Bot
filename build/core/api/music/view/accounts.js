"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHTML = void 0;
const generateHTML = (options) => {
    const { title, icon, iconColor, heading, message, submessage, username, platformLogo } = options;
    return `
		<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>${title}</title>
				<link rel="preconnect" href="https://fonts.googleapis.com">
				<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
				<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
				<style>
					* {
						margin: 0;
						padding: 0;
						box-sizing: border-box;
					}

					body {
						font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						min-height: 100vh;
						display: flex;
						justify-content: center;
						align-items: center;
						background: linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #0d0d0d 100%);
						color: #ffffff;
						padding: 20px;
					}

					.card {
						background: rgba(255, 255, 255, 0.03);
						backdrop-filter: blur(20px);
						border: 1px solid rgba(255, 255, 255, 0.08);
						border-radius: 24px;
						padding: 48px;
						max-width: 420px;
						width: 100%;
						text-align: center;
						box-shadow: 
							0 4px 24px rgba(0, 0, 0, 0.4),
							0 0 80px rgba(29, 185, 84, 0.08);
						animation: fadeInUp 0.6s ease-out;
					}

					@keyframes fadeInUp {
						from {
							opacity: 0;
							transform: translateY(20px);
						}
						to {
							opacity: 1;
							transform: translateY(0);
						}
					}

					.icon-wrapper {
						width: 80px;
						height: 80px;
						border-radius: 50%;
						display: flex;
						align-items: center;
						justify-content: center;
						margin: 0 auto 24px;
						font-size: 36px;
						animation: scaleIn 0.5s ease-out 0.2s both;
					}

					.icon-wrapper.success {
						background: linear-gradient(135deg, rgba(29, 185, 84, 0.2), rgba(29, 185, 84, 0.05));
						border: 2px solid rgba(29, 185, 84, 0.3);
						box-shadow: 0 0 40px rgba(29, 185, 84, 0.2);
					}

					.icon-wrapper.error {
						background: linear-gradient(135deg, rgba(255, 68, 68, 0.2), rgba(255, 68, 68, 0.05));
						border: 2px solid rgba(255, 68, 68, 0.3);
						box-shadow: 0 0 40px rgba(255, 68, 68, 0.2);
					}

					.icon-wrapper.warning {
						background: linear-gradient(135deg, rgba(255, 184, 0, 0.2), rgba(255, 184, 0, 0.05));
						border: 2px solid rgba(255, 184, 0, 0.3);
						box-shadow: 0 0 40px rgba(255, 184, 0, 0.2);
					}

					@keyframes scaleIn {
						from {
							opacity: 0;
							transform: scale(0.5);
						}
						to {
							opacity: 1;
							transform: scale(1);
						}
					}

					h1 {
						font-size: 24px;
						font-weight: 700;
						margin-bottom: 12px;
						letter-spacing: -0.5px;
					}

					h1.success { color: #1DB954; }
					h1.error { color: #ff6b6b; }
					h1.warning { color: #ffb800; }

					.message {
						color: rgba(255, 255, 255, 0.7);
						font-size: 15px;
						line-height: 1.6;
						margin-bottom: 8px;
					}

					.submessage {
						color: rgba(255, 255, 255, 0.4);
						font-size: 13px;
						margin-top: 16px;
					}

					.username-badge {
						display: inline-flex;
						align-items: center;
						gap: 8px;
						background: rgba(29, 185, 84, 0.1);
						border: 1px solid rgba(29, 185, 84, 0.2);
						border-radius: 100px;
						padding: 10px 20px;
						margin-top: 20px;
						font-size: 14px;
						font-weight: 500;
						color: #1DB954;
					}

					.username-badge svg {
						width: 18px;
						height: 18px;
						fill: currentColor;
					}

					.platform-logo {
						margin-top: 32px;
						opacity: 0.3;
					}

					.platform-logo svg {
						width: 24px;
						height: 24px;
						fill: #ffffff;
					}

					.divider {
						height: 1px;
						background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
						margin: 24px 0;
					}
				</style>
			</head>
			<body>
				<div class="card">
					<div class="icon-wrapper ${iconColor}">
						${icon}
					</div>
					<h1 class="${iconColor}">${heading}</h1>
					<p class="message">${message}</p>
					${username
        ? `
						<div class="username-badge">
							<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
							${username}
						</div>
					`
        : ''}
					${submessage
        ? `
						<div class="divider"></div>
						<p class="submessage">${submessage}</p>
					`
        : ''}
					<div class="platform-logo">
						${platformLogo || ''}
					</div>
				</div>
			</body>
		</html>
	`;
};
exports.generateHTML = generateHTML;
