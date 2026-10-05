# Romte Remote

<p align="center">
  <strong>Private LAN Remote Desktop and Real-Time PC ↔ Mobile Communication for Windows</strong>
</p>

<p align="center">
  Control your Windows PC from a phone, transfer files, synchronize clipboard content, and communicate in real time — without relying on a cloud service.
</p>

<p align="center">
  <a href="https://github.com/aleemshahad/Romote_Desktop_pro/releases">Download Releases</a>
  ·
  <a href="https://github.com/aleemshahad/Romote_Desktop_pro/issues">Report an Issue</a>
</p>

---

## Overview

**Romte Remote** is a lightweight, open-source remote desktop and communication application designed for Windows.

It creates a private connection between a Windows PC and a phone on the same local network. From a mobile browser, you can view and interact with the PC, while the built-in communication layer provides real-time chat, file transfer, and clipboard sharing.

The project is designed around a simple principle: **keep the connection local, keep the setup simple, and keep the user in control.**

No cloud account is required, and normal operation does not depend on an external remote-access service.

## Key Features

| Feature | Description |
|---|---|
| **Remote Desktop Control** | View the Windows desktop and interact with the mouse and keyboard from a phone. |
| **Live Screen Streaming** | Stream the PC screen to the connected mobile device. |
| **Real-Time Chat** | Send messages instantly between the PC and mobile device, with persistent chat history. |
| **File Transfer** | Transfer files between the PC and connected mobile device over the local network. |
| **Clipboard Sharing** | Move text between the Windows clipboard and the mobile interface. |
| **Secure Access Code** | Connections require a generated access token before Socket.IO communication is accepted. |
| **LAN-First Architecture** | Designed for private local-network communication without requiring a cloud account. |
| **Windows Desktop App** | Electron-based desktop interface with Windows installer and portable builds. |
| **Portable Mode** | Run the application without a traditional installation. |
| **Simple User Experience** | Designed to work without requiring users to manage a terminal window during normal desktop use. |

## How It Works

Romte Remote runs a local server on the Windows PC and exposes the web interface to devices connected to the same network.

1. Launch Romte Remote on Windows.
2. The application generates or loads its persistent access code.
3. Open the displayed mobile link on a phone connected to the same Wi-Fi or hotspot.
4. Authenticate using the access token included in the link.
5. Use the remote-control interface, chat, file transfer, and clipboard features.

The server uses **Express** for HTTP services and **Socket.IO** for real-time communication.

Remote mouse and keyboard control is provided through **RobotJS**, while desktop screenshots are captured through **screenshot-desktop**.

## Architecture

At a high level, the project is organized around the following components:

- **Electron desktop application** — Windows desktop experience.
- **Node.js server** — local application server and API entry point.
- **Express** — HTTP server and static web delivery.
- **Socket.IO** — real-time communication between clients.
- **RobotJS** — mouse and keyboard automation.
- **screenshot-desktop** — desktop screen capture.
- **Multer** — file upload handling.
- **Local state storage** — persistent application state and access-token data.

### Project Structure

```text
Romote_Desktop_pro/
├── bin/                 # CLI entry point
├── build/               # Windows application resources
├── desktop/             # Electron desktop application
├── lib/                 # Server-side application modules
├── public/              # Web interface
├── scripts/             # Build and utility scripts
├── .github/             # GitHub configuration
├── server.js            # Node.js server entry point
├── run_server.bat       # Windows server launcher
├── package.json         # Project configuration and dependencies
└── README.md            # Project documentation
```

## Requirements

### End Users

- Windows 10 or Windows 11
- Android or iOS device with a modern web browser
- PC and mobile device connected to the same Wi-Fi network or hotspot

### Development

- Node.js
- npm
- Windows environment for Windows desktop builds

## Installation

### Windows Installer

Download the latest Windows installer from the project's:

**[GitHub Releases](https://github.com/aleemshahad/Romote_Desktop_pro/releases)**

The installer creates a normal Windows application installation and can create desktop and Start Menu shortcuts.

### Portable Version

A portable Windows executable is also available through the Releases page.

The portable build can be launched directly without going through a traditional installation process.

## Run From Source

Clone the repository:

```bash
git clone https://github.com/aleemshahad/Romote_Desktop_pro.git
cd Romote_Desktop_pro
```

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm start
```

For the Electron desktop application:

```bash
npm run desktop
```

To build Windows releases:

```bash
npm run build:win
```

## Windows Quick Start

If you are using the packaged Windows application:

1. Launch **Romte Remote**.
2. Open the **Link** or connection information inside the application.
3. Copy the generated mobile URL.
4. Make sure the phone and PC are connected to the same local network.
5. Open the URL on the phone.
6. Use the remote desktop and communication tools.

If Windows Firewall asks for network access, allow the application on the appropriate **Private Network** profile.

## Security Model

Romte Remote is designed for private LAN usage.

Each running installation maintains an access token that is used to protect the application endpoints and Socket.IO connection. Unauthorized Socket.IO clients are rejected when the supplied token does not match the server token.

### Important

The application is intended primarily for trusted local networks.

A LAN-only design is **not the same as end-to-end encryption or internet-grade remote-access security**. Avoid exposing the application directly to the public internet unless you have added and properly configured an appropriate security layer.

Never share your access code or connection URL with untrusted users.

## Privacy

Romte Remote is designed to keep normal communication inside your local network.

The project does not require:

- A cloud account
- A mandatory third-party remote-access service
- A centralized application account

Files and application state are handled locally by the application.

## Available Commands

| Command | Purpose |
|---|---|
| `npm start` | Start the local Node.js server |
| `npm run desktop` | Launch the Electron desktop application |
| `npm run icon` | Generate application icon resources |
| `npm run build:win` | Build Windows installer and portable packages |

## Current Windows Build

The project configuration currently produces:

- **NSIS installer** for Windows x64
- **Portable Windows x64 executable**

The configured product name is **Romte Remote**.

## Contributing

Contributions are welcome.

If you find a bug, have a feature request, or want to improve the project:

1. Open an issue describing the problem or proposed feature.
2. Keep changes focused and well documented.
3. Test the affected functionality before submitting a pull request.
4. Explain the reason for the change and any relevant implementation details.

## Roadmap Ideas

Potential future improvements include:

- Better remote input performance
- Improved screen streaming efficiency
- More advanced clipboard synchronization
- Enhanced file-transfer controls
- Connection management for multiple trusted devices
- Improved authentication and security options
- Cross-platform desktop support
- More detailed connection and system diagnostics

## License

This project is released under the **ISC License**.

See the repository source for the complete implementation and license terms.

## Author

**Aleem Shahzad**

Automation Specialist · Full-Stack Developer · Software & AI Automation

GitHub: [@aleemshahad](https://github.com/aleemshahad)

---

<p align="center">
  Built with Node.js, Electron, Express, Socket.IO, and open-source technologies.
</p>
