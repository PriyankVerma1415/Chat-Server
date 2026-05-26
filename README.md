# Zyphora 💬

A modern, real-time messaging platform built with Next.js, Node.js, Socket.IO, and Firebase — inspired by WhatsApp.

![Zyphora Chat UI](https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)

---

## ✨ Features

- 📱 **Phone Number Authentication** — OTP-based login via Firebase
- 💬 **Real-time Messaging** — powered by Socket.IO
- 📎 **Media Sharing** — Images, videos, and documents
- 🎤 **Audio Recording** — Record and send voice notes
- 📞 **1v1 Audio & Video Calls** — Native WebRTC
- ✏️ **Message Editing** — Edit messages within 5 minutes
- ↩️ **Message Replies** — Reply to any message in thread
- 🗑️ **Delete Messages** — Remove messages from chat
- 👀 **Read Receipts** — Single ✓ (sent), Double ✓ (delivered), Blue ✓✓ (read)
- 🟢 **Online/Offline Status** — With last seen timestamp
- 😄 **Emoji Picker** — Built-in emoji support
- 📋 **Contact Info Popup** — View user profile on click
- 🌙 **Dark / Light Mode** — System-aware theme
- 🎨 **WhatsApp-style Background** — Iconic doodle pattern

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Styling** | Tailwind CSS v4, shadcn/ui |
| **State Management** | Zustand |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas (via Mongoose) |
| **Real-time** | Socket.IO |
| **Authentication** | Firebase Phone Auth (OTP) |
| **File Storage** | Firebase Storage |
| **Video/Audio Calls** | Native WebRTC |

---

## 📋 Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** v18 or higher → [Download](https://nodejs.org/)
- **npm** v9 or higher (comes with Node.js)
- **Git** → [Download](https://git-scm.com/)
- A **MongoDB Atlas** account → [Sign up free](https://www.mongodb.com/cloud/atlas)
- A **Firebase** project → [Create one](https://console.firebase.google.com/)

---

## 🚀 Getting Started

### Step 1 — Clone the Repository

```bash
git clone https://github.com/PriyankVerma1415/Chat-Server.git
cd Chat-Server
```

---

### Step 2 — Set Up Firebase

You need a Firebase project for:
1. **Phone OTP authentication** (backend uses Firebase Admin SDK)
2. **File storage** (images, videos, documents)

#### 2a. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** → give it a name → click **Continue**
3. Disable Google Analytics if you don't need it → **Create project**

#### 2b. Enable Phone Authentication
1. In your project, go to **Authentication → Sign-in method**
2. Click **Phone** → toggle **Enable** → **Save**

#### 2c. Enable Firebase Storage
1. Go to **Build → Storage** → **Get started**
2. Choose a region → **Done**
3. In the **Rules** tab, set to allow reads/writes (for dev):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

#### 2d. Get Your Firebase Web App Config (for the client)
1. Go to **Project Settings** (gear icon) → **Your apps**
2. Click **Add app → Web** → register it
3. Copy the config object — you'll need it in **Step 4**

#### 2e. Download Firebase Admin Service Account (for the server)
1. Go to **Project Settings → Service accounts**
2. Click **Generate new private key** → **Generate key**
3. Save the downloaded JSON file as `firebaseServiceAccount.json` inside the `server/` folder

> ⚠️ **NEVER commit `firebaseServiceAccount.json` to Git!** It is already in `.gitignore`.

---

### Step 3 — Set Up MongoDB Atlas

1. Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a **free M0 cluster**
3. Under **Database Access**, create a user with read/write privileges
4. Under **Network Access**, add `0.0.0.0/0` (allow all — fine for development)
5. Click **Connect → Drivers** → copy the connection string
6. Replace `<password>` in the string with your database user's password

---

### Step 4 — Configure the Server

```bash
cd server
cp .env.example .env
```

Now open `server/.env` and fill in all the values:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>
ACCESS_TOKEN_SECRET=<generate a random 64-char string>
REFRESH_TOKEN_SECRET=<generate a different random 64-char string>
CLIENT_URL=http://localhost:3000
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
```

> **Tip:** Generate secure secrets quickly with this command:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```
> Run it twice — once for each secret.

---

### Step 5 — Install Server Dependencies

```bash
# Still inside the server/ folder
npm install
```

---

### Step 6 — Configure the Client

```bash
cd ../client
cp .env.local.example .env.local
```

Open `client/.env.local` and fill in your Firebase Web App config values from **Step 2d**:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1027767...
NEXT_PUBLIC_FIREBASE_APP_ID=1:1027767...:web:...
```

---

### Step 7 — Install Client Dependencies

```bash
# Inside the client/ folder
npm install
```

---

### Step 8 — Run the Application

You need **two terminal windows** running simultaneously.

**Terminal 1 — Start the Backend Server:**
```bash
cd server
npm run dev
```
You should see:
```
Server running on port 5000
✅ Firebase Admin initialized.
✅ MongoDB connected
```

**Terminal 2 — Start the Frontend:**
```bash
cd client
npm run dev
```
You should see:
```
▲ Next.js 16.x
- Local: http://localhost:3000
```

---

### Step 9 — Open in Browser

Visit **[http://localhost:3000](http://localhost:3000)**

1. Enter your phone number
2. Receive an OTP via SMS (Firebase)
3. Complete your profile (username, bio, avatar)
4. Add contacts and start chatting!

---

## 📁 Project Structure

```
Chat-Server/
├── client/                    # Next.js Frontend
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   ├── components/
│   │   │   ├── auth/          # Login & OTP screens
│   │   │   ├── call/          # WebRTC call overlay
│   │   │   ├── chat/          # ChatWindow, MessageBubble, etc.
│   │   │   ├── contacts/      # Contact list sidebar
│   │   │   └── ui/            # shadcn/ui base components
│   │   ├── lib/               # Utility functions, Firebase client init
│   │   └── store/             # Zustand state stores
│   ├── .env.local.example     # Client environment template
│   └── package.json
│
└── server/                    # Express.js Backend
    ├── src/
    │   ├── config/            # MongoDB & Firebase Admin setup
    │   ├── controllers/       # Route handler logic
    │   ├── middleware/        # Auth guards, error handling
    │   ├── models/            # Mongoose schemas (User, Message, Conversation)
    │   ├── routes/            # Express route definitions
    │   ├── socket/            # Socket.IO event handler
    │   └── server.js          # App entry point
    ├── firebaseServiceAccount.json  # ← NOT committed (add yourself)
    ├── .env.example           # Server environment template
    └── package.json
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/verify-otp` | Verify Firebase OTP & issue JWT |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Logout & clear cookie |
| `GET` | `/api/users/me` | Get logged-in user profile |
| `PUT` | `/api/users/me` | Update profile |
| `GET` | `/api/messages/conversations` | List all conversations |
| `GET` | `/api/messages/:conversationId` | Get messages in a conversation |
| `POST` | `/api/messages` | Send a new message |
| `PUT` | `/api/messages/:id` | Edit a message |
| `DELETE` | `/api/messages/:id` | Delete a message |
| `GET` | `/api/contacts` | Get user contacts |
| `POST` | `/api/contacts/sync` | Sync phone contacts |

---

## 🔊 Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join` | Client → Server | Join personal room |
| `send_message` | Client → Server | Send a chat message |
| `new_message` | Server → Client | Receive a new message |
| `typing` | Client → Server | User is typing |
| `stop_typing` | Client → Server | User stopped typing |
| `message_read` | Client → Server | Mark messages as read |
| `webrtc_offer` | Client → Server | WebRTC call offer |
| `webrtc_answer` | Client → Server | WebRTC call answer |
| `webrtc_ice_candidate` | Client ↔ Server | ICE candidates |
| `call_ended` | Client → Server | End a call |

---

## 🐛 Troubleshooting

**"Firebase Admin NOT initialized"**
→ Make sure `firebaseServiceAccount.json` is placed inside the `server/` folder.

**"MongoDB connection failed"**
→ Check your `MONGODB_URI` in `server/.env`. Ensure your IP is whitelisted in MongoDB Atlas Network Access.

**OTP not received**
→ Firebase Phone Auth requires a real phone number. Make sure your Firebase project's **Phone Authentication** is enabled and your phone number isn't blocked.

**CORS errors in browser**
→ Make sure `CLIENT_URL` in `server/.env` matches exactly where your frontend is running (e.g., `http://localhost:3000`).

**Call not connecting**
→ WebRTC requires both peers to be on the same network OR a TURN server configured. For LAN testing it works out of the box.

---

## 📜 License

This project is licensed under the ISC License.

---

## 🙏 Acknowledgements

- [Firebase](https://firebase.google.com/) for Auth & Storage
- [MongoDB Atlas](https://www.mongodb.com/) for the database
- [Socket.IO](https://socket.io/) for real-time events
- [shadcn/ui](https://ui.shadcn.com/) for the component library
- [lucide-react](https://lucide.dev/) for icons
