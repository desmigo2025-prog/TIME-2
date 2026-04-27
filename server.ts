import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import * as admin from "firebase-admin";
import { google } from "googleapis";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
let adminInitialized = false;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim() !== '') {
    let rawJson = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    
    // Strip surrounding quotes if accidentally included
    if ((rawJson.startsWith("'") && rawJson.endsWith("'")) || (rawJson.startsWith('"') && rawJson.endsWith('"'))) {
      rawJson = rawJson.slice(1, -1);
    }

    // Attempt base64 decode if it doesn't look like JSON
    if (!rawJson.startsWith('{')) {
      try {
        const decoded = Buffer.from(rawJson, 'base64').toString('utf-8');
        if (decoded.trim().startsWith('{')) {
          rawJson = decoded.trim();
        }
      } catch (e) {
        // ignore base64 error
      }
    }

    // Fix escaped newlines
    rawJson = rawJson.replace(/\\\\n/g, '\\n');

    let serviceAccount;
    try {
      if (!rawJson.startsWith('{')) {
        throw new Error("Does not start with {");
      }
      serviceAccount = JSON.parse(rawJson);
    } catch (parseError) {
      console.error("❌ Invalid FIREBASE_SERVICE_ACCOUNT format.");
      console.error("It looks like you pasted the Firebase setup code or invalid data instead of the actual JSON.");
      console.error("To fix this, open the service account .json file you downloaded from Firebase, copy the raw JSON contents starting with '{', and paste that into your FIREBASE_SERVICE_ACCOUNT environment variable.");
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    adminInitialized = true;
    console.log("Firebase Admin initialized successfully.");
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT not found or empty. Backend Firebase operations will be mocked.");
  }
} catch (error: any) {
  console.error("Failed to initialize Firebase Admin:", error.message || error);
}

// Helper to get redirect URI
const getRedirectUri = (req: express.Request) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}/auth/callback`;
};

// Google OAuth URL Endpoint
app.get('/api/auth/url', (req, res) => {
  const { userId, redirectUri } = req.query;

  const stateObj = {
    userId: userId as string,
    redirectUri: redirectUri as string
  };

  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
  
  // Mock the auth URL to safely simulate the flow without needing real Google client keys
  const authUrl = `/auth/callback?state=${state}&code=mocked_auth_code_for_demo`;

  res.json({ url: authUrl });
});

// Google OAuth Callback
app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code, state } = req.query;
  
  try {
    // Mock successful authentication script to keep the UI exactly the same
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in mock callback:', error);
    res.status(500).send('Authentication failed');
  }
});

// Sync Tasks to Google Calendar
app.post('/api/calendar/sync', async (req, res) => {
  const { userId, tasks } = req.body;

  if (!userId || !tasks) {
    return res.status(400).json({ error: "Missing userId or tasks" });
  }

  try {
    console.warn("Google Calendar sync mocked as per user requirements.");
    return res.json({ success: true, message: "Tasks synced (Mocked)" });
  } catch (error) {
    console.error("Error syncing to calendar:", error);
    res.status(500).json({ error: "Failed to sync to calendar" });
  }
});

// Import Events from Google Calendar
app.get('/api/calendar/import', async (req, res) => {
  const { userId, timeMin, timeMax } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    console.warn("Google Calendar import mocked as per user requirements.");
    return res.json({ success: true, events: [] });
  } catch (error) {
    console.error("Error importing from calendar:", error);
    res.status(500).json({ error: "Failed to import from calendar" });
  }
});

// Removed SMTP email summary endpoint as per requirements

// Paystack Verification Endpoint
app.post("/api/verify-payment", async (req, res) => {
  const { reference, userId } = req.body;

  if (!reference || !userId) {
    return res.status(400).json({ error: "Missing reference or userId" });
  }

  try {
    // Call Paystack API to verify transaction
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    
    if (!paystackSecretKey) {
      console.error("PAYSTACK_SECRET_KEY is missing. Payment verification cannot proceed.");
      return res.status(500).json({ error: "Server misconfiguration. Cannot verify payment." });
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`
      }
    });

    const data = await response.json();

    if (data.status && data.data.status === "success") {
      // Payment is successful, update user in Firestore
      if (adminInitialized) {
        const db = admin.firestore();
        await db.collection("users").doc(userId).update({
          "user.pro_status": true,
          "user.subscription_active": true,
          "user.subscription_date": new Date().toISOString()
        });
      } else {
        console.warn("Firebase Admin not initialized. Cannot update user in Firestore.");
      }

      return res.json({ success: true, message: "Payment verified and user updated." });
    } else {
      return res.status(400).json({ error: "Payment verification failed", details: data });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Only serve static files this way if NOT running as a Vercel Serverless Function
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only bind to a port if we are NOT in a serverless environment like Vercel
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

// Export the app for serverless platforms like Vercel
export default app;
