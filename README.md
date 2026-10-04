# Romte Remote

**Apne PC ko mobile se control karein — aur PC ↔ mobile ke liye built-in chat.**

Romte Remote aapke Windows PC ko phone ka remote control banata hai: screen live dekhein, mouse chalayein, type karein, files bhejein, clipboard sync karein, aur computer–phone ke beech real-time chat karein. Sab kuch **aapke apne network** par chalta hai — internet ki zaroorat nahi, account nahi, cloud nahi.

---

## ✨ Fayde (Features)

| | |
|---|---|
| 📱 **Remote control** | Phone se PC ki screen dekhein, mouse chalayein, type karein |
| 💬 **Real-time chat** | PC ↔ phone mein foran messages — history save rehti hai, app restart hone ke baad bhi |
| 📁 **File transfer** | Dono taraf se files bhejein, doosri taraf tap karke download |
| 📋 **Clipboard sync** | PC ka clipboard phone par laayein, phone ka text PC par bhejein |
| 🔒 **Private & safe** | Access code zaroori hai — aapke network ke bahar koi access nahi |
| 🪟 **Sirf ek window** | Koi terminal/cmd nahi khulta — simple, kisi bhi user ke liye |

---

## ⬇️ Install kaise karein (Windows)

1. **[Releases](https://github.com/aleemshahad/Romote_Desktop_pro/releases)** page se New Version EXE download karein:
   - **[Installer version](https://github.com/aleemshahad/Romote_Desktop_pro/releases/download/v2.1.4/Remote-Desktop-pro-2.1.4-win-x64.exe)** — install karke Start Menu / Desktop shortcut ban jata hai, ya
   - **[Remote-Desktop-pro-Portable.exe](https://github.com/aleemshahad/Romote_Desktop_pro/releases/download/v2.1.4/Remote-Desktop-pro-Portable.exe)** — bina install kiye seedha chalayein
2. EXE par double-click karein — **ek hi window khulti hai (chat window)**. Koi terminal/cmd nahi khulta.

Bas — install complete.

> **Node.js users:** `npm install -g romte-remote` se bhi install ho jata hai, phir terminal mein `romte-remote` chalayein.

---

## 🚀 Use kaise karein

### Step 1 — Phone link lein
Chat window mein **📱 Link** button dabayein → panel khulega jismein:

- 🔑 **Access code** (tap = copy)
- 📱 **Phone link** — `http://<PC-IP>:5000/?token=...` (tap = copy)

> Pehli baar app khola? Yeh panel **khud ba khud** khul jata hai.

### Step 2 — Phone par kholein
1. Phone aur PC **same Wi-Fi (ya hotspot)** par hon
2. Phone browser mein link paste karein
3. Bas — access code link mein pehle se majood hai

### Step 3 — Chat karein
- **Type + Send** — dono taraf foran pahunchta hai
- **📎 Attach** — file bhejein, doosri taraf tap karke download
- **📋 Copy** — koi bhi message/link copy karein
- **🗑 Clear** — **dono sides** ki history saaf ho jati hai

### Remote control page
- **Drag** = mouse chalayein · **Tap** = click
- **Pinch** = zoom · **2 ungli** se drag = pan
- Keyboard / clipboard / voice buttons se type aur copy-paste

---

## 🖱️ Chat window ke buttons

| Button | Kya karta hai |
|---|---|
| 🖥️ **Remote** | Remote-control panel khulta hai (screen + mouse/keyboard) |
| 📱 **Link** | Connection info: access code + phone links (tap = copy) |
| 📎 **Attach** | File bhejein |
| 🗑 **Clear** | Dono sides ki chat history delete |
| ⏻ **Exit** | App poora band (installer version) |

---

## 📌 Zaroori baatein

- **Access code** 📱 Link panel mein milta hai — restart ke baad bhi wahi rehta hai
- Phone aur PC **ek hi network** par hone chahiye (Wi-Fi ya hotspot)
- Pehli baar Windows Firewall poochhe to **Private network** par "Allow" karein
- App chalte rehta hai; band karne ke liye **⏻ Exit** dabayein

## ✅ Requirements

- **PC:** Windows 10 / 11
- **Phone:** koi bhi browser (Android / iOS)
- **Network:** same Wi-Fi / hotspot

---

## License

ISC — free hai: use karein, modify karein, share karein. Open-source code isi repository mein hai.
