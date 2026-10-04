# 🖥️ Romte Remote Desktop

**Remote Desktop + PC ↔ Mobile Chat**

ایک طاقتور ریموٹ ڈیسک ٹاپ اور چیٹ اپلیکیشن جو آپ کے PC اور موبائل کو جوڑتی ہے۔

---

## 📋 فہرست

- [عام صارفین کے لیے](#-عام-صارفین-کے-لیے)
- [ترقی دہندگان کے لیے](#-ترقی-دہندگان-کے-لیے)
- [خصوصیات](#-خصوصیات)
- [ٹرابل شوٹنگ](#-ٹرابل-شوٹنگ)

---

## 🎯 عام صارفین کے لیے

### طریقہ 1: Executable انسٹال کریں (آسان ترین)

1. [GitHub Releases](https://github.com/aleemshahad/Romte_Desktop_pro/releases) سے تازہ ترین `.exe` ڈاؤن لوڈ کریں
2. انسٹالر کو چلائیں اور ہدایات پر عمل کریں
3. Romte Remote کھول کریں - یہ خود کار طور پر شروع ہوگا ✅

**فوائل:**
- ✨ کوئی ٹرمینل نہیں - صاف اور سادہ انٹرفیس
- 🔒 محفوظ - Electron میں ہر چیز خود مختار
- 📱 فوری - کوئی setup نہیں

---

### طریقہ 2: NPM سے انسٹال کریں (ترقی دہندگان کے لیے)

اگر آپ Node.js جانتے ہیں:

```bash
# نصب کریں
npm install -g romte-remote

# چلائیں
romte-remote
```

**ترقی دہندگان کے لیے تفصیل:**
- یہ `npm` کے ذریعے دستیاب ہوگا
- `romte-remote` کمانڈ براہ راست Terminal میں چلے گی
- تمام dependencies خود بخود انسٹال ہوں گی

---

## 💻 ترقی دہندگان کے لیے

### انسٹالیشن

```bash
# Repository کو clone کریں
git clone https://github.com/aleemshahad/Romte_Desktop_pro.git
cd Romte_Desktop_pro

# Dependencies انسٹال کریں
npm install
```

### Development کریں

```bash
# Server شروع کریں (Terminal میں)
npm start

# موبائل: http://localhost:7778/?token=XXXXXXXX
# Desktop UI: http://localhost:7778/chat
```

### Desktop App بنائیں

```bash
# Windows .exe بنائیں
npm run build:win

# Output: dist/Romte Remote 2.0.0 Windows x64.exe
```

### Custom Executable بنانا

اگر آپ ایک محدود .exe بنانا چاہتے ہیں جو terminal نہ دکھائے:

```bash
# Step 1: Icon بنائیں
npm run icon

# Step 2: Build کریں
npm run build:win

# Output میں خود بخود کوئی terminal نہیں ہوگا ✅
```

---

## 🌟 خصوصیات

| خصوصی | وضاحت |
|------|--------|
| 🖥️ **Remote Desktop** | اپنے PC کو دوسری جگہ سے کنٹرول کریں |
| 💬 **Live Chat** | PC اور Mobile کے درمیان فوری پیغام |
| 📸 **Screen Sharing** | Real-time اسکرین broadcast |
| 🖱️ **Mouse & Keyboard** | دوری سے کنٹرول کریں |
| 📤 **File Upload** | سہل فائل اپ لوڈ |
| 🔐 **Secure Token** | ہر بار اپ لوڈ شروع ہونے پر نیا کوڈ |

---

## ⚙️ تشکیل

### Windows

`%APPDATA%\RomteRemote\state.json` میں تبدیلیاں کریں

```json
{
  "port": 7778,
  "notificationOnStartup": true,
  "token": "abc12345"
}
```

### Linux/Mac

`~/.romte-remote/state.json` میں

---

## 🔧 ٹرابل شوٹنگ

### ❌ **پورٹ پہلے سے استعمال میں ہے**

```bash
# Windows میں چیک کریں
Get-NetTCPConnection -LocalPort 7778

# Server بند کریں اور دوبارہ کوشش کریں
```

### ❌ **Screenshot/Mouse نہیں کام کر رہے**

- robotjs اور screenshot-desktop dependencies داخل ہیں
- Windows Admin میں چلائیں

### ❌ **Firewall مسائل**

- Windows Defender Firewall میں Romte کو اجازت دیں
- یا manual port open کریں

---

## 📦 نصب کے طریقے

### Source سے
```bash
npm install ./Romte_Desktop_pro
```

### NPM Registry سے (جلد آ رہا ہے)
```bash
npm install romte-remote
```

### Standalone Portable
- `RomteRemote-Portable.exe` - نصب کی ضرورت نہیں

---

## 📱 موبائل سے رابطہ کریں

ایک بار server شروع ہونے کے بعد:

1. اپنی ڈیسک ٹاپ اپلیکیشن میں **Access Code** دیکھیں
2. موبائل براؤزر میں جائیں: `http://YOUR_PC_IP:7778/?token=XXXXXX`
3. چیٹ شروع کریں! 💬

---

## 🛠️ API اور Socket Events

Server WebSocket API بھیجتا ہے:

```javascript
socket.emit('screenshot', (image) => { /* ... */ });
socket.emit('mouse', { x: 100, y: 200 });
socket.emit('chat', { message: 'Hello!' });
```

---

## 📄 لائسنس

ISC License - حرے استعمال کریں، ترمیم کریں، بانٹیں

---

## 👨‍💻 شراکت

مسائل یا بہتریوں کے لیے GitHub Issues کھولیں۔

---

**سوالات ہیں؟** Issues میں اطلاع دیں: https://github.com/aleemshahad/Romte_Desktop_pro/issues

